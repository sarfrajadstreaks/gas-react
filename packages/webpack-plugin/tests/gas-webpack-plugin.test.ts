import { describe, it, expect, vi } from 'vitest';
import { GASWebpackPlugin } from '../src/gas-webpack-plugin';

// ── Mock types matching the plugin's internal interfaces ─────────────

function createMockSource(content: string) {
  return {
    source: () => content,
    size: () => Buffer.byteLength(content, 'utf-8'),
  };
}

function createMockChunk(opts: {
  id: string | number;
  name: string | null;
  files: string[];
  isEntry?: boolean;
  asyncChunks?: ReturnType<typeof createMockChunk>[];
  referencedChunks?: ReturnType<typeof createMockChunk>[];
}) {
  const filesSet = new Set(opts.files);
  const chunk = {
    id: opts.id,
    name: opts.name,
    files: filesSet,
    isOnlyInitial: () => opts.isEntry ?? false,
    getAllAsyncChunks: () => new Set(opts.asyncChunks ?? []),
    getAllReferencedChunks: () => new Set([chunk, ...(opts.referencedChunks ?? [])]),
  };
  return chunk;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('GASWebpackPlugin', () => {
  it('instantiates with default options', () => {
    const plugin = new GASWebpackPlugin();
    expect(plugin).toBeDefined();
  });

  it('instantiates with custom options', () => {
    const plugin = new GASWebpackPlugin({
      pagePrefix: 'view_',
      appTitle: 'My App',
      serverEntry: 'src/server/index.ts',
    });
    expect(plugin).toBeDefined();
  });

  it('has an apply method', () => {
    const plugin = new GASWebpackPlugin();
    expect(typeof plugin.apply).toBe('function');
  });

  it('taps into emit hook when apply is called', () => {
    const plugin = new GASWebpackPlugin();
    const tapPromiseFn = vi.fn();
    const compiler = {
      options: { context: '/project', output: {} },
      hooks: {
        thisCompilation: { tap: vi.fn() },
        emit: { tapAsync: vi.fn(), tapPromise: tapPromiseFn },
      },
    };

    plugin.apply(compiler as never);
    expect(tapPromiseFn).toHaveBeenCalledWith('GASWebpackPlugin', expect.any(Function));
  });
});

describe('GASWebpackPlugin — transformOutput', () => {
  let emittedAssets: Record<string, string>;
  let deletedAssets: string[];

  function createMockCompilation(opts: {
    entryCode: string;
    entryFileName?: string;
    htmlContent?: string;
    asyncChunks?: Array<{
      id: string | number;
      name: string;
      fileName: string;
      code: string;
    }>;
  }) {
    const entryFileName = opts.entryFileName ?? 'main.js';
    emittedAssets = {};
    deletedAssets = [];

    const assets: Record<string, ReturnType<typeof createMockSource>> = {
      [entryFileName]: createMockSource(opts.entryCode),
    };

    if (opts.htmlContent) {
      assets['index.html'] = createMockSource(opts.htmlContent);
    }

    const asyncChunkObjects = (opts.asyncChunks ?? []).map((c) => {
      assets[c.fileName] = createMockSource(c.code);
      return createMockChunk({
        id: c.id,
        name: c.name,
        files: [c.fileName],
      });
    });

    const entryChunk = createMockChunk({
      id: 'main',
      name: 'main',
      files: [entryFileName],
      isEntry: true,
      asyncChunks: asyncChunkObjects,
    });

    const allChunks = new Set([entryChunk, ...asyncChunkObjects]);

    const entrypoint = {
      getFiles: () => [entryFileName],
      chunks: [entryChunk],
    };

    return {
      assets,
      entrypoints: new Map([['main', entrypoint]]),
      chunks: allChunks,
      chunkGraph: { getChunkModules: () => [] },
      getAsset: (name: string) => assets[name] ? { source: assets[name] } : undefined,
      updateAsset: (name: string, source: ReturnType<typeof createMockSource>) => {
        assets[name] = source;
        emittedAssets[name] = source.source();
      },
      emitAsset: (name: string, source: ReturnType<typeof createMockSource>) => {
        assets[name] = source;
        emittedAssets[name] = source.source();
      },
      deleteAsset: (name: string) => {
        delete assets[name];
        deletedAssets.push(name);
      },
    };
  }

  it('generates Code.js with doGet, getPage, getEntryCode', async () => {
    const plugin = new GASWebpackPlugin({ appTitle: 'TestApp' });

    const compilation = createMockCompilation({
      entryCode: 'console.log("hello");',
      htmlContent: '<html><body></body></html>',
    });

    // Call the private method via the tap callback
    const tapFn = vi.fn();
    const compiler = {
      options: { context: '/project', output: {} },
      hooks: {
        thisCompilation: { tap: vi.fn() },
        emit: {
          tapAsync: vi.fn(),
          tapPromise: (_name: string, fn: (comp: unknown) => Promise<void>) => {
            tapFn.mockImplementation(fn);
          },
        },
      },
    };

    plugin.apply(compiler as never);
    await tapFn(compilation);

    expect(emittedAssets['Code.js']).toBeDefined();
    expect(emittedAssets['Code.js']).toContain('function doGet()');
    expect(emittedAssets['Code.js']).toContain("setTitle('TestApp')");
    expect(emittedAssets['Code.js']).toContain('function getPage(name)');
    expect(emittedAssets['Code.js']).toContain('function getEntryCode()');
  });

  it('generates appsscript.json', async () => {
    const plugin = new GASWebpackPlugin();

    const compilation = createMockCompilation({
      entryCode: 'console.log("hello");',
      htmlContent: '<html><body></body></html>',
    });

    const tapFn = vi.fn();
    const compiler = {
      options: { context: '/project', output: {} },
      hooks: {
        thisCompilation: { tap: vi.fn() },
        emit: {
          tapAsync: vi.fn(),
          tapPromise: (_name: string, fn: (comp: unknown) => Promise<void>) => {
            tapFn.mockImplementation(fn);
          },
        },
      },
    };

    plugin.apply(compiler as never);
    await tapFn(compilation);

    expect(emittedAssets['appsscript.json']).toBeDefined();
    const manifest = JSON.parse(emittedAssets['appsscript.json']);
    expect(manifest.runtimeVersion).toBe('V8');
    expect(manifest.webapp.access).toBe('ANYONE_ANONYMOUS');
  });

  it('emits __gas_entry__.js with entry code as string variable', async () => {
    const plugin = new GASWebpackPlugin();

    const compilation = createMockCompilation({
      entryCode: 'var app = "hello";',
      htmlContent: '<html><body></body></html>',
    });

    const tapFn = vi.fn();
    const compiler = {
      options: { context: '/project', output: {} },
      hooks: {
        thisCompilation: { tap: vi.fn() },
        emit: {
          tapAsync: vi.fn(),
          tapPromise: (_name: string, fn: (comp: unknown) => Promise<void>) => {
            tapFn.mockImplementation(fn);
          },
        },
      },
    };

    plugin.apply(compiler as never);
    await tapFn(compilation);

    expect(emittedAssets['__gas_entry__.js']).toBeDefined();
    expect(emittedAssets['__gas_entry__.js']).toContain('__GAS_ENTRY_CODE__');
    expect(emittedAssets['__gas_entry__.js']).toContain('hello');
  });

  it('deletes original entry JS from output', async () => {
    const plugin = new GASWebpackPlugin();

    const compilation = createMockCompilation({
      entryCode: 'var app = "hello";',
      htmlContent: '<html><body></body></html>',
    });

    const tapFn = vi.fn();
    const compiler = {
      options: { context: '/project', output: {} },
      hooks: {
        thisCompilation: { tap: vi.fn() },
        emit: {
          tapAsync: vi.fn(),
          tapPromise: (_name: string, fn: (comp: unknown) => Promise<void>) => {
            tapFn.mockImplementation(fn);
          },
        },
      },
    };

    plugin.apply(compiler as never);
    await tapFn(compilation);

    expect(deletedAssets).toContain('main.js');
  });

  it('injects GAS chunk loader script into HTML', async () => {
    const plugin = new GASWebpackPlugin();

    const compilation = createMockCompilation({
      entryCode: 'var app = true;',
      htmlContent: '<html><head></head><body><div id="root"></div></body></html>',
    });

    const tapFn = vi.fn();
    const compiler = {
      options: { context: '/project', output: {} },
      hooks: {
        thisCompilation: { tap: vi.fn() },
        emit: {
          tapAsync: vi.fn(),
          tapPromise: (_name: string, fn: (comp: unknown) => Promise<void>) => {
            tapFn.mockImplementation(fn);
          },
        },
      },
    };

    plugin.apply(compiler as never);
    await tapFn(compilation);

    const html = compilation.assets['index.html'].source();
    expect(html).toContain('origAppendChild');
    expect(html).toContain('getEntryCode');
    expect(html).toContain('google.script.run');
  });

  it('removes script tags from HTML', async () => {
    const plugin = new GASWebpackPlugin();

    const compilation = createMockCompilation({
      entryCode: 'var app = true;',
      htmlContent:
        '<html><head></head><body><script src="main.js"></script></body></html>',
    });

    const tapFn = vi.fn();
    const compiler = {
      options: { context: '/project', output: {} },
      hooks: {
        thisCompilation: { tap: vi.fn() },
        emit: {
          tapAsync: vi.fn(),
          tapPromise: (_name: string, fn: (comp: unknown) => Promise<void>) => {
            tapFn.mockImplementation(fn);
          },
        },
      },
    };

    plugin.apply(compiler as never);
    await tapFn(compilation);

    const html = compilation.assets['index.html'].source();
    expect(html).not.toContain('src="main.js"');
  });
});

