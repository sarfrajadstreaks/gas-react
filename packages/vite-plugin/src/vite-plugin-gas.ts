interface GASPluginOptions {
  pagePrefix?: string;
  appTitle?: string;
}

interface VitePlugin {
  name: string;
  enforce?: 'pre' | 'post';
  renderChunk?: (code: string, chunk: ChunkInfo) => string | null;
  transformIndexHtml?: (html: string) => string;
  generateBundle?: (options: unknown, bundle: Record<string, BundleItem>) => void;
}

interface ChunkInfo {
  fileName: string;
  isEntry: boolean;
  dynamicImports: string[];
  imports?: string[];
  exports?: string[];
  facadeModuleId?: string | null;
}

interface BundleItem {
  type: 'chunk' | 'asset';
  fileName: string;
  code?: string;
  source?: string | Uint8Array;
}

export function gasPlugin(options: GASPluginOptions = {}): VitePlugin {
  const { pagePrefix = 'page_', appTitle = 'GAS App' } = options;
  const lazyPageNames = new Set<string>();
  const fileToGasName = new Map<string, string>();

  function toGasName(fileName: string, isLazyPage: boolean): string {
    const baseName = fileName.split('/').pop()!;
    const cleanName = baseName.replace(/-.*$/, '').replace(/\.js$/, '');
    return isLazyPage ? `${pagePrefix}${cleanName}` : `lib_${cleanName}`;
  }

  return {
    name: 'vite-plugin-gas',
    enforce: 'post',

    renderChunk(code: string, chunk: ChunkInfo): string | null {
      if (!chunk.isEntry) return null;

      let modified = code;
      let changed = false;

      for (const dynamicImport of chunk.dynamicImports) {
        const baseName = dynamicImport.split('/').pop()!;
        const pageName = baseName.replace(/-.*$/, '').replace(/\.js$/, '');
        const gasPageName = `${pagePrefix}${pageName}`;

        lazyPageNames.add(pageName);

        const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const importPattern = new RegExp(
          `import\\(\\s*["']\\.\\/` + escapedBase + `["']\\s*\\)`,
          'g'
        );
        const replacement = `__gasLoadChunk("${gasPageName}")`;

        const newCode = modified.replace(importPattern, replacement);
        if (newCode !== modified) {
          modified = newCode;
          changed = true;
        }
      }

      return changed ? modified : null;
    },

    transformIndexHtml(html: string): string {
      const gasScript = `
<script>
(function() {
  var deps = __GAS_DEPS_MAP__;
  var chunkCache = {};

  window.__gasLoadChunk = function(name) {
    if (chunkCache[name]) return chunkCache[name];

    var promise = new Promise(function(resolve, reject) {
      var chunkDeps = deps[name] || [];
      var depPromises = chunkDeps.map(function(dep) { return window.__gasLoadChunk(dep); });

      Promise.all(depPromises).then(function() {
        google.script.run
          .withSuccessHandler(function(js) {
            var script = document.createElement('script');
            script.textContent = js;
            document.head.appendChild(script);

            var exports = window.__gasChunkExports || {};
            resolve(exports);
            delete window.__gasChunkExports;
          })
          .withFailureHandler(function(err) {
            reject(new Error('Failed to load chunk: ' + name));
          })
          .getPage(name);
      });
    });

    chunkCache[name] = promise;
    return promise;
  };

  google.script.run
    .withSuccessHandler(function(js) {
      var s = document.createElement('script');
      s.textContent = js;
      document.head.appendChild(s);
    })
    .withFailureHandler(function(err) {
      document.body.innerHTML = 'Failed to load app: ' + err;
    })
    .getEntryCode();
})();
</script>`;

      html = html.replace('</body>', gasScript + '\n</body>');

      return html;
    },

    generateBundle(_options: unknown, bundle: Record<string, BundleItem>): void {
      let entryFileName: string | null = null;
      let entryCode: string | null = null;

      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && (item as unknown as ChunkInfo).isEntry) {
          entryFileName = fileName;
          entryCode = item.code || '';
          break;
        }
      }

      if (entryFileName && entryCode) {
        const htmlKey = Object.keys(bundle).find(k => k.endsWith('.html'));
        if (htmlKey) {
          const htmlItem = bundle[htmlKey];
          let html = typeof htmlItem.source === 'string'
            ? htmlItem.source
            : new TextDecoder().decode(htmlItem.source as Uint8Array);

          html = html.replace(
            /<script\b[^>]*src=["'][^"']*["'][^>]*>\s*<\/script>/g,
            ''
          );

          for (const [fileName, item] of Object.entries(bundle)) {
            if (item.type !== 'chunk') continue;
            if (fileName === entryFileName) continue;
            const baseName = fileName.split('/').pop()!;
            const cleanName = baseName.replace(/-.*$/, '').replace(/\.js$/, '');
            const isLazy = lazyPageNames.has(cleanName);
            fileToGasName.set(fileName, toGasName(fileName, isLazy));
          }

          let cleanedEntry = rewriteImportsToGlobals(entryCode, entryFileName, fileToGasName);
          cleanedEntry = rewriteExportsToNamespace(cleanedEntry, 'window.__gasEntry__');
          cleanedEntry = `window.__gasEntry__={};\nvar __VITE_PRELOAD__=void 0;\n` + cleanedEntry;

          bundle['__gas_entry__.js'] = {
            type: 'asset',
            fileName: '__gas_entry__.js',
            source: `var __GAS_ENTRY_CODE__ = ${JSON.stringify(cleanedEntry)};`,
          };

          delete bundle[entryFileName];

          const chunkVars: string[] = [];
          const depsMap: Record<string, string[]> = {};

          for (const [fileName, item] of Object.entries(bundle)) {
            if (item.type !== 'chunk') continue;
            if (fileName === entryFileName) continue;

            const gasName = fileToGasName.get(fileName);
            if (!gasName) continue;

            const chunkInfo = item as unknown as ChunkInfo;
            let code = item.code || '';

            code = rewriteImportsToGlobals(code, fileName, fileToGasName);

            const baseName = fileName.split('/').pop()!;
            const cleanName = baseName.replace(/-.*$/, '').replace(/\.js$/, '');
            const isLazy = lazyPageNames.has(cleanName);

            if (isLazy) {
              code = rewriteExportsToObject(code);
              const wrappedCode = `(function() {
  var __exports = {};
  ${code}
  window.__gasChunkExports = __exports;
})();`;
              chunkVars.push(`var __GAS_CHUNK_${gasName}__ = ${JSON.stringify(wrappedCode)};`);
            } else {
              code = rewriteExportsToObject(code);
              const wrappedCode = `(function() {
  var __exports = {};
  ${code}
  window.__gasLib_${gasName}__ = __exports;
})();`;
              chunkVars.push(`var __GAS_CHUNK_${gasName}__ = ${JSON.stringify(wrappedCode)};`);
            }

            const chunkDeps: string[] = [];
            if (chunkInfo.imports) {
              for (const imp of chunkInfo.imports) {
                const depGasName = fileToGasName.get(imp);
                if (depGasName) chunkDeps.push(depGasName);
              }
            }
            if (chunkDeps.length > 0) {
              depsMap[gasName] = chunkDeps;
            }

            delete bundle[fileName];
          }

          if (chunkVars.length > 0) {
            bundle['__gas_chunks__.js'] = {
              type: 'asset',
              fileName: '__gas_chunks__.js',
              source: chunkVars.join('\n'),
            };
          }

          const depsJson = JSON.stringify(depsMap);
          html = html.replace('__GAS_DEPS_MAP__', depsJson);
          htmlItem.source = html;

          const codeJs = `function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('${appTitle.replace(/'/g, "\\'")}')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getPage(name) {
  var varName = '__GAS_CHUNK_' + name + '__';
  var code = globalThis[varName];
  if (!code) throw new Error('Chunk not found: ' + name);
  return code;
}

function getEntryCode() {
  return __GAS_ENTRY_CODE__;
}
`;
          bundle['Code.js'] = {
            type: 'asset',
            fileName: 'Code.js',
            source: codeJs,
          };

          bundle['appsscript.json'] = {
            type: 'asset',
            fileName: 'appsscript.json',
            source: JSON.stringify({
              timeZone: 'Asia/Kolkata',
              dependencies: {},
              webapp: {
                access: 'ANYONE_ANONYMOUS',
                executeAs: 'USER_DEPLOYING',
              },
              exceptionLogging: 'STACKDRIVER',
              runtimeVersion: 'V8',
            }, null, 2),
          };
        }
      }
    },
  };
}

/** Rewrite ESM exports to assignments on a namespace object. */
function rewriteExportsToNamespace(code: string, namespace: string): string {
  let result = code;
  result = result.replace(/export\s*\{([^}]*)\}\s*;?/g, (_match, inner: string) => {
    return inner
      .split(',')
      .map((binding) => {
        const parts = binding.trim().split(/\s+as\s+/);
        const local = parts[0].trim();
        const exported = (parts[1] || parts[0]).trim();
        return exported ? `${namespace}.${exported}=${local};` : '';
      })
      .filter(Boolean)
      .join('');
  });
  result = result.replace(/export\s+default\s+(\w+)\s*;/g, `${namespace}.default=$1;`);
  return result;
}

/** Rewrite ESM imports to var declarations reading from the correct namespace. */
function rewriteImportsToGlobals(
  code: string,
  chunkFileName: string,
  fileToGasName: Map<string, string>,
): string {
  const lastSlash = chunkFileName.lastIndexOf('/');
  const chunkDir = lastSlash >= 0 ? chunkFileName.substring(0, lastSlash) : '';

  return code.replace(
    /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']\s*;?/g,
    (_match, bindings: string, importPath: string) => {
      let sourceObj = 'window';

      if (importPath.startsWith('./')) {
        const resolved = chunkDir
          ? `${chunkDir}/${importPath.slice(2)}`
          : importPath.slice(2);
        const gasName = fileToGasName.get(resolved);
        if (gasName?.startsWith('lib_')) {
          sourceObj = `window.__gasLib_${gasName}__`;
        } else if (!gasName) {
          sourceObj = 'window.__gasEntry__';
        }
      }

      return bindings
        .split(',')
        .map((binding) => {
          const parts = binding.trim().split(/\s+as\s+/);
          const original = parts[0].trim();
          const local = (parts[1] || original).trim();
          if (!original) return '';
          return `var ${local} = ${sourceObj}.${original};`;
        })
        .filter(Boolean)
        .join('\n');
    }
  );
}

/** Rewrite ESM exports to assign to an __exports object (used for chunks). */
function rewriteExportsToObject(code: string): string {
  let result = code;

  result = result.replace(
    /export\s+default\s+(\w+)\s*;/g,
    '__exports.default = $1;'
  );

  result = result.replace(
    /export\s*\{([^}]+)\}\s*;/g,
    (_match, inner: string) => {
      return inner
        .split(',')
        .map((binding) => {
          const parts = binding.trim().split(/\s+as\s+/);
          const local = parts[0].trim();
          const exported = (parts[1] || parts[0]).trim();
          return `__exports.${exported} = ${local};`;
        })
        .join('\n  ');
    }
  );

  result = result.replace(
    /export\s+(const|let|var)\s+(\w+)/g,
    '$1 $2'
  );

  return result;
}
