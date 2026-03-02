import { describe, it, expect } from 'vitest';
import { gasPlugin } from '../src/vite-plugin-gas';

function makeChunkInfo(overrides: Record<string, unknown> = {}) {
  return {
    fileName: 'assets/index-abc.js',
    isEntry: true,
    dynamicImports: [],
    imports: [],
    exports: [],
    facadeModuleId: null,
    ...overrides,
  };
}

describe('gasPlugin', () => {
  it('returns a plugin object with correct name and enforce', () => {
    const plugin = gasPlugin();
    expect(plugin.name).toBe('vite-plugin-gas');
    expect(plugin.enforce).toBe('post');
  });

  it('uses default options when none provided', () => {
    const plugin = gasPlugin();
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('vite-plugin-gas');
  });

  it('accepts custom options', () => {
    const plugin = gasPlugin({
      pagePrefix: 'view_',
      appTitle: 'Custom App',
    });
    expect(plugin).toBeDefined();
  });
});

describe('renderChunk', () => {
  it('returns null for non-entry chunks', () => {
    const plugin = gasPlugin();
    const chunk = makeChunkInfo({ isEntry: false });
    const result = plugin.renderChunk!('const x = 1;', chunk);
    expect(result).toBeNull();
  });

  it('returns null when entry has no dynamic imports', () => {
    const plugin = gasPlugin();
    const chunk = makeChunkInfo({ isEntry: true, dynamicImports: [] });
    const result = plugin.renderChunk!('const x = 1;', chunk);
    expect(result).toBeNull();
  });

  it('rewrites dynamic imports to __gasLoadChunk calls', () => {
    const plugin = gasPlugin({ pagePrefix: 'page_' });
    const code = `const Home = import("./Home-abc123.js");`;
    const chunk = makeChunkInfo({
      isEntry: true,
      dynamicImports: ['Home-abc123.js'],
    });
    const result = plugin.renderChunk!(code, chunk);
    expect(result).toContain('__gasLoadChunk("page_Home")');
    expect(result).not.toContain('import(');
  });

  it('rewrites multiple dynamic imports', () => {
    const plugin = gasPlugin();
    const code = `
      const Home = import("./Home-abc.js");
      const About = import("./About-def.js");
    `;
    const chunk = makeChunkInfo({
      isEntry: true,
      dynamicImports: ['Home-abc.js', 'About-def.js'],
    });
    const result = plugin.renderChunk!(code, chunk);
    expect(result).toContain('__gasLoadChunk("page_Home")');
    expect(result).toContain('__gasLoadChunk("page_About")');
  });

  it('uses custom page prefix', () => {
    const plugin = gasPlugin({ pagePrefix: 'view_' });
    const code = `const Settings = import("./Settings-xyz.js");`;
    const chunk = makeChunkInfo({
      isEntry: true,
      dynamicImports: ['Settings-xyz.js'],
    });
    const result = plugin.renderChunk!(code, chunk);
    expect(result).toContain('__gasLoadChunk("view_Settings")');
  });
});

describe('transformIndexHtml', () => {
  it('injects the chunk loader script before </body>', () => {
    const plugin = gasPlugin();
    const html = '<html><body><div id="root"></div></body></html>';
    const result = plugin.transformIndexHtml!(html);
    expect(result).toContain('window.__gasLoadChunk');
    expect(result).toContain('google.script.run');
    expect(result).toContain('getEntryCode');
    expect(result).toContain('__GAS_DEPS_MAP__');
  });

  it('preserves existing HTML content', () => {
    const plugin = gasPlugin();
    const html = '<html><head><title>Test</title></head><body><div id="root"></div></body></html>';
    const result = plugin.transformIndexHtml!(html);
    expect(result).toContain('<title>Test</title>');
    expect(result).toContain('<div id="root"></div>');
  });
});

describe('generateBundle', () => {
  function makeBundle(entryCode: string, dynamicChunks: Record<string, string> = {}) {
    const bundle: Record<string, Record<string, unknown>> = {};

    bundle['assets/index-abc.js'] = {
      type: 'chunk',
      fileName: 'assets/index-abc.js',
      code: entryCode,
      isEntry: true,
      dynamicImports: Object.keys(dynamicChunks).map(k => `assets/${k}`),
      imports: [],
      exports: [],
    };

    for (const [fileName, code] of Object.entries(dynamicChunks)) {
      bundle[`assets/${fileName}`] = {
        type: 'chunk',
        fileName: `assets/${fileName}`,
        code,
        isEntry: false,
        dynamicImports: [],
        imports: [],
        exports: ['default'],
      };
    }

    bundle['index.html'] = {
      type: 'asset',
      fileName: 'index.html',
      source: '<html><body><script src="./assets/index-abc.js"></script>__GAS_DEPS_MAP__</body></html>',
    };

    return bundle;
  }

  it('generates Code.js with doGet, getPage, getEntryCode', async () => {
    const plugin = gasPlugin({ appTitle: 'Test App' });

    // First call renderChunk to register lazy pages
    const entryCode = `const Home = import("./Home-xyz.js");`;
    plugin.renderChunk!(entryCode, makeChunkInfo({
      isEntry: true,
      dynamicImports: ['Home-xyz.js'],
    }));

    const bundle = makeBundle(entryCode, { 'Home-xyz.js': 'export default function Home() {}' });
    await plugin.generateBundle!({}, bundle as never);

    expect(bundle['Code.js']).toBeDefined();
    const codeJs = bundle['Code.js'].source as string;
    expect(codeJs).toContain('function doGet()');
    expect(codeJs).toContain("setTitle('Test App')");
    expect(codeJs).toContain('function getPage(name)');
    expect(codeJs).toContain('function getEntryCode()');
  });

  it('generates __gas_entry__.js with entry code as string variable', async () => {
    const plugin = gasPlugin();
    const entryCode = `console.log("hello");`;
    plugin.renderChunk!(entryCode, makeChunkInfo({ isEntry: true, dynamicImports: [] }));

    const bundle = makeBundle(entryCode);
    await plugin.generateBundle!({}, bundle as never);

    expect(bundle['__gas_entry__.js']).toBeDefined();
    const entryAsset = bundle['__gas_entry__.js'].source as string;
    expect(entryAsset).toContain('var __GAS_ENTRY_CODE__');
    expect(entryAsset).toContain('window.__gasEntry__');
  });

  it('generates __gas_chunks__.js for lazy page chunks', async () => {
    const plugin = gasPlugin();

    const entryCode = `const Home = import("./Home-abc.js");`;
    plugin.renderChunk!(entryCode, makeChunkInfo({
      isEntry: true,
      dynamicImports: ['Home-abc.js'],
    }));

    const bundle = makeBundle(entryCode, {
      'Home-abc.js': `function Home() { return "home"; }\nexport default Home;`,
    });
    await plugin.generateBundle!({}, bundle as never);

    expect(bundle['__gas_chunks__.js']).toBeDefined();
    const chunks = bundle['__gas_chunks__.js'].source as string;
    expect(chunks).toContain('__GAS_CHUNK_page_Home__');
  });

  it('generates appsscript.json', async () => {
    const plugin = gasPlugin();
    const bundle = makeBundle('const x = 1;');
    plugin.renderChunk!('const x = 1;', makeChunkInfo({ isEntry: true, dynamicImports: [] }));
    await plugin.generateBundle!({}, bundle as never);

    expect(bundle['appsscript.json']).toBeDefined();
    const manifest = JSON.parse(bundle['appsscript.json'].source as string);
    expect(manifest.webapp).toBeDefined();
    expect(manifest.webapp.access).toBe('ANYONE_ANONYMOUS');
    expect(manifest.runtimeVersion).toBe('V8');
  });

  it('removes original entry chunk from bundle', async () => {
    const plugin = gasPlugin();
    const entryCode = 'const x = 1;';
    plugin.renderChunk!(entryCode, makeChunkInfo({ isEntry: true, dynamicImports: [] }));

    const bundle = makeBundle(entryCode);
    await plugin.generateBundle!({}, bundle as never);

    expect(bundle['assets/index-abc.js']).toBeUndefined();
  });

  it('strips script tags from HTML', async () => {
    const plugin = gasPlugin();
    const entryCode = 'const x = 1;';
    plugin.renderChunk!(entryCode, makeChunkInfo({ isEntry: true, dynamicImports: [] }));

    const bundle = makeBundle(entryCode);
    await plugin.generateBundle!({}, bundle as never);

    const html = bundle['index.html'].source as string;
    expect(html).not.toContain('<script src=');
  });

  it('escapes single quotes in appTitle', async () => {
    const plugin = gasPlugin({ appTitle: "Tom's App" });
    const entryCode = 'const x = 1;';
    plugin.renderChunk!(entryCode, makeChunkInfo({ isEntry: true, dynamicImports: [] }));

    const bundle = makeBundle(entryCode);
    await plugin.generateBundle!({}, bundle as never);

    const codeJs = bundle['Code.js'].source as string;
    expect(codeJs).toContain("Tom\\'s App");
  });

  it('handles shared lib chunks with correct namespace', async () => {
    const plugin = gasPlugin();

    const entryCode = `import { Button } from "./Stack-def.js";\nconst Home = import("./Home-abc.js");`;
    plugin.renderChunk!(entryCode, makeChunkInfo({
      isEntry: true,
      dynamicImports: ['Home-abc.js'],
      imports: ['assets/Stack-def.js'],
    }));

    const bundle: Record<string, Record<string, unknown>> = {};
    bundle['assets/index-abc.js'] = {
      type: 'chunk',
      fileName: 'assets/index-abc.js',
      code: entryCode,
      isEntry: true,
      dynamicImports: ['assets/Home-abc.js'],
      imports: ['assets/Stack-def.js'],
      exports: [],
    };
    bundle['assets/Home-abc.js'] = {
      type: 'chunk',
      fileName: 'assets/Home-abc.js',
      code: `function Home() {}\nexport default Home;`,
      isEntry: false,
      dynamicImports: [],
      imports: ['assets/Stack-def.js'],
      exports: ['default'],
    };
    bundle['assets/Stack-def.js'] = {
      type: 'chunk',
      fileName: 'assets/Stack-def.js',
      code: `function Button() {}\nexport { Button };`,
      isEntry: false,
      dynamicImports: [],
      imports: [],
      exports: ['Button'],
    };
    bundle['index.html'] = {
      type: 'asset',
      fileName: 'index.html',
      source: '<html><body><script src="./assets/index-abc.js"></script>__GAS_DEPS_MAP__</body></html>',
    };

    await plugin.generateBundle!({}, bundle as never);

    const chunks = bundle['__gas_chunks__.js']?.source as string;
    expect(chunks).toContain('__GAS_CHUNK_page_Home__');
    expect(chunks).toContain('__GAS_CHUNK_lib_Stack__');
    expect(chunks).toContain('window.__gasLib_lib_Stack__');
  });
});
