/**
 * webpack-plugin-gas-react
 *
 * Webpack plugin that deploys React apps to Google Apps Script
 * with automatic code splitting support.
 *
 * Equivalent of vite-plugin-gas-react but for webpack 5+.
 */

import path from 'node:path';

// ── Types ────────────────────────────────────────────────────────────

export interface GASWebpackPluginOptions {
  /** Prefix for lazy-loaded page chunk GAS names (default: "page_") */
  pagePrefix?: string;
  /** Title for the GAS web app (default: "GAS App") */
  appTitle?: string;
  /** Path to the server entry file (e.g. "src/server/index.ts") */
  serverEntry?: string;
}

interface WebpackCompiler {
  options: {
    context: string;
    output: { path?: string; publicPath?: string };
  };
  hooks: {
    thisCompilation: {
      tap(name: string, fn: (compilation: WebpackCompilation) => void): void;
    };
    compilation: {
      tap(name: string, fn: (compilation: WebpackCompilation) => void): void;
    };
  };
  webpack: {
    Compilation: {
      PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER: number;
    };
    sources: {
      RawSource: new (content: string) => WebpackSource;
    };
  };
}

interface WebpackCompilation {
  assets: Record<string, WebpackSource>;
  entrypoints: Map<string, WebpackEntrypoint>;
  chunks: Set<WebpackChunk>;
  chunkGraph: {
    getChunkModules(chunk: WebpackChunk): WebpackModule[];
  };
  hooks: {
    processAssets: {
      tapPromise(
        options: { name: string; stage: number },
        fn: () => Promise<void>,
      ): void;
    };
  };
  getAsset(name: string): { source: WebpackSource } | undefined;
  updateAsset(name: string, source: WebpackSource): void;
  emitAsset(name: string, source: WebpackSource): void;
  deleteAsset(name: string): void;
}

interface WebpackSource {
  source(): string;
  size(): number;
  sourceAndMap?(): { source: string; map: unknown };
  map?(): unknown;
}

interface WebpackEntrypoint {
  getFiles(): string[];
  chunks: WebpackChunk[];
}

interface WebpackChunk {
  id: string | number | null;
  name: string | null;
  files: Set<string>;
  isOnlyInitial(): boolean;
  getAllAsyncChunks(): Set<WebpackChunk>;
  getAllReferencedChunks(): Set<WebpackChunk>;
}

interface WebpackModule {
  resource?: string;
  rootModule?: WebpackModule;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a simple webpack-compatible source object (fallback only, prefer compiler.webpack.sources.RawSource) */
function createRawSource(content: string): WebpackSource {
  const buf = Buffer.byteLength(content, 'utf-8');
  return {
    source: () => content,
    size: () => buf,
    sourceAndMap: () => ({ source: content, map: null }),
    map: () => null,
  };
}

/**
 * Strip ESM export statements and make functions/variables globally accessible.
 * Used only for server code bundled via esbuild.
 */
function hoistExports(code: string): string {
  let result = code;
  result = result.replaceAll(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '');
  result = result.replaceAll(/^export\s+default\s+/gm, '');
  result = result.replaceAll(/^export\s+/gm, '');
  return result;
}

// ── GAS chunk loader script (injected into HTML) ────────────────────
//
// Strategy: intercept Node.prototype.appendChild so that when webpack's
// runtime appends a <script src="192.js"> for a lazy chunk, we load the
// chunk code via google.script.run.getPage() instead of fetching via HTTP.
// The chunk code is in webpack's native JSONP format, so when executed it
// calls the JSONP callback, resolves webpack's promise, and everything works.

function getChunkLoaderScript(): string {
  return String.raw`
<script>
(function() {
  var knownChunks = __GAS_KNOWN_CHUNKS__;
  var origAppendChild = Node.prototype.appendChild;

  Node.prototype.appendChild = function(child) {
    if (child.tagName === 'SCRIPT' && child.src) {
      var m = child.src.match(/([^\/]+)\.js(?:\?.*)?$/);
      if (m && knownChunks[m[1]]) {
        var chunkName = m[1];
        google.script.run
          .withSuccessHandler(function(code) {
            var s = document.createElement('script');
            s.textContent = code;
            origAppendChild.call(document.head, s);
            if (child.onload) child.onload({ type: 'load', target: child });
          })
          .withFailureHandler(function(err) {
            if (child.onerror) child.onerror({ type: 'error', target: child });
          })
          .getPage(chunkName);
        return child;
      }
    }
    return origAppendChild.call(this, child);
  };

  google.script.run
    .withSuccessHandler(function(js) {
      var s = document.createElement('script');
      s.textContent = js;
      origAppendChild.call(document.head, s);
    })
    .withFailureHandler(function(err) {
      document.body.innerHTML = '<pre>Failed to load app: ' + err + '</pre>';
    })
    .getEntryCode();
})();
</script>`;
}

// ── Main Plugin Class ────────────────────────────────────────────────

const PLUGIN_NAME = 'GASWebpackPlugin';

export class GASWebpackPlugin {
  private readonly options: {
    appTitle: string;
    serverEntry?: string;
  };

  constructor(options: GASWebpackPluginOptions = {}) {
    this.options = {
      appTitle: options.appTitle ?? 'GAS App',
      serverEntry: options.serverEntry,
    };
  }

  private makeSource: (content: string) => WebpackSource = createRawSource;

  apply(compiler: WebpackCompiler): void {
    // Prefer webpack's built-in RawSource for full compatibility with
    // the processAssets pipeline (terser etc. call sourceAndMap()).
    if (compiler.webpack?.sources?.RawSource) {
      const { RawSource } = compiler.webpack.sources;
      this.makeSource = (content: string) => new RawSource(content);
    }

    // Use compilation.hooks.processAssets instead of the deprecated compiler.hooks.emit
    // to avoid the DEP_WEBPACK_COMPILATION_ASSETS warning in webpack 5.
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        },
        async () => {
          await this.transformOutput(compilation, compiler);
        },
      );
    });
  }

  private async transformOutput(
    compilation: WebpackCompilation,
    compiler: WebpackCompiler,
  ): Promise<void> {
    const { appTitle, serverEntry } = this.options;

    // ── Step 1: Identify entry and async chunks ────────────────────
    const entrypoint = compilation.entrypoints.get('main');
    if (!entrypoint) return;

    const entryFiles = entrypoint.getFiles().filter((f) => f.endsWith('.js'));
    if (entryFiles.length === 0) return;

    const entryFileName = entryFiles[entryFiles.length - 1];
    const entryAsset = compilation.assets[entryFileName];
    if (!entryAsset) return;

    const entryCode = entryAsset.source();

    // Collect all async (lazy) chunks
    const asyncChunks = new Set<WebpackChunk>();
    for (const chunk of entrypoint.chunks) {
      for (const asyncChunk of chunk.getAllAsyncChunks()) {
        asyncChunks.add(asyncChunk);
      }
    }

    // ── Step 2: Wrap entry code as a string variable ───────────────
    // No rewriting needed — we intercept chunk loading at the DOM level
    const entryVar = `var __GAS_ENTRY_CODE__ = ${JSON.stringify(entryCode)};`;
    compilation.emitAsset('__gas_entry__.js', this.makeSource(entryVar));

    // ── Step 3: Store async chunks as separate GAS files ───────────
    // Keep chunks in their ORIGINAL webpack JSONP format. When executed
    // in the browser, the JSONP callback fires and webpack's runtime
    // resolves the promise — no import/export rewriting needed.
    const knownChunks: Record<string, boolean> = {};

    for (const chunk of asyncChunks) {
      for (const file of chunk.files) {
        if (!file.endsWith('.js')) continue;
        const asset = compilation.assets[file];
        if (!asset) continue;

        const code = asset.source();
        const baseName = file.replace(/\.js$/, '');
        const safeName = baseName.replaceAll(/\W/g, '_');

        // Emit each chunk as a separate file instead of bundling them
        const chunkFileName = `chunks/__gas_chunk_${safeName}__.js`;
        const chunkContent = `var __GAS_CHUNK_${safeName}__ = ${JSON.stringify(code)};`;
        compilation.emitAsset(chunkFileName, this.makeSource(chunkContent));
        
        knownChunks[baseName] = true;

        compilation.deleteAsset(file);
      }
    }

    // Remove original entry JS
    compilation.deleteAsset(entryFileName);

    // Remove other entry JS files (runtime, etc.)
    for (const file of entryFiles) {
      if (file !== entryFileName && compilation.assets[file]) {
        compilation.deleteAsset(file);
      }
    }

    // ── Step 4: Transform HTML ─────────────────────────────────────
    const htmlFile = Object.keys(compilation.assets).find((f) => f.endsWith('.html'));
    if (htmlFile) {
      let html = compilation.assets[htmlFile].source();

      // Remove script tags (webpack injects them, we load code via GAS)
      html = html.replaceAll(/<script\b[^>]*src=["'][^"']*["'][^>]*>\s*<\/script>/g, '');
      html = html.replaceAll(/<script\b[^>]*defer[^>]*>\s*<\/script>/g, '');

      // Inject GAS chunk loader with the known chunk map
      const loaderScript = getChunkLoaderScript();
      const finalScript = loaderScript.replace(
        '__GAS_KNOWN_CHUNKS__',
        JSON.stringify(knownChunks),
      );
      html = html.replace('</body>', finalScript + '\n</body>');

      compilation.assets[htmlFile] = this.makeSource(html);
    }

    // ── Step 5: Generate Code.js ───────────────────────────────────
    let codeJs = '';

    if (serverEntry) {
      try {
        const esbuild = await import('esbuild');
        const serverPath = path.resolve(compiler.options.context, serverEntry);
        const result = await esbuild.build({
          entryPoints: [serverPath],
          bundle: true,
          format: 'esm',
          platform: 'neutral',
          target: 'es2020',
          write: false,
          external: [],
        });
        let serverCode = result.outputFiles[0].text;
        serverCode = hoistExports(serverCode);
        codeJs += serverCode + '\n';
      } catch (err) {
        console.error('[GASWebpackPlugin] Failed to bundle server entry:', err);
      }
    }

    const escapedTitle = appTitle.replaceAll("'", String.raw`\'`);

    codeJs += [
      `function doGet() {`,
      `  return HtmlService.createHtmlOutputFromFile('index')`,
      `    .setTitle('${escapedTitle}')`,
      `    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);`,
      `}`,
      ``,
      `function getPage(name) {`,
      String.raw`  var safeName = name.replace(/\W/g, '_');`,
      `  var varName = '__GAS_CHUNK_' + safeName + '__';`,
      `  var code = globalThis[varName];`,
      `  if (!code) throw new Error('Chunk not found: ' + name);`,
      `  return code;`,
      `}`,
      ``,
      `function getEntryCode() {`,
      `  return __GAS_ENTRY_CODE__;`,
      `}`,
      ``,
    ].join('\n');

    compilation.emitAsset('Code.js', this.makeSource(codeJs));

    // ── Step 6: Generate appsscript.json ───────────────────────────
    const appsscript = JSON.stringify(
      {
        timeZone: 'Asia/Kolkata',
        dependencies: {},
        webapp: {
          access: 'ANYONE_ANONYMOUS',
          executeAs: 'USER_DEPLOYING',
        },
        exceptionLogging: 'STACKDRIVER',
        runtimeVersion: 'V8',
      },
      null,
      2,
    );

    compilation.emitAsset('appsscript.json', this.makeSource(appsscript));
  }
}
