import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export { gasPlugin } from './vite-plugin-gas';

async function importFromProject(specifier: string): Promise<unknown> {
  const require = createRequire(path.resolve(process.cwd(), 'package.json'));
  const resolved = require.resolve(specifier);
  return import(pathToFileURL(resolved).href);
}

export function isLocalDev(): boolean {
  return process.env.GAS_LOCAL === 'true';
}

export interface GASViteOptions {
  clientRoot?: string;
  outDir?: string;
  devServerPort?: number;
  devPort?: number;
  aliases?: Record<string, string>;
  plugins?: unknown[];
  appTitle?: string;
  serverEntry?: string;
  vite?: Record<string, unknown>;
}

export async function createGASViteConfig(
  options: GASViteOptions = {}
): Promise<Record<string, unknown>> {
  const {
    clientRoot = 'src/client',
    outDir = 'dist',
    devServerPort = 3001,
    devPort = 5173,
    aliases = {},
    plugins: extraPlugins = [],
    appTitle,
    serverEntry,
    vite: overrides = {},
  } = options;

  const local = isLocalDev();
  const projectRoot = process.cwd();
  const clientDepth = clientRoot.split('/').filter(Boolean).length;
  const relativeOutDir = '../'.repeat(clientDepth) + outDir;

  const plugins: unknown[] = [];

  try {
    const mod = await importFromProject('@vitejs/plugin-react') as Record<string, unknown>;
    const reactPlugin = mod.default ?? mod;
    plugins.push(typeof reactPlugin === 'function' ? (reactPlugin as () => unknown)() : reactPlugin);
  } catch {
    console.warn(
      '⚠️  @vitejs/plugin-react not found. Install it:\n' +
      '   npm install -D @vitejs/plugin-react\n'
    );
  }

  if (!local) {
    const { gasPlugin } = await import('./vite-plugin-gas');
    plugins.push(gasPlugin({ appTitle, serverEntry }));
  }

  plugins.push(...extraPlugins);

  const resolvedAliases: Record<string, string> = {
    '@': path.resolve(projectRoot, 'src'),
    ...Object.fromEntries(
      Object.entries(aliases).map(([key, val]) => [
        key,
        path.resolve(projectRoot, val),
      ])
    ),
  };

  const config: Record<string, unknown> = {
    root: clientRoot,
    plugins,
    resolve: { alias: resolvedAliases },
    build: { outDir: relativeOutDir, emptyOutDir: true },
  };

  if (local) {
    config.define = {
      'window.__GAS_DEV_MODE__': 'true',
      'window.__GAS_DEV_SERVER__': JSON.stringify(`http://localhost:${devServerPort}`),
    };
    config.server = { port: devPort, open: true };
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (
      typeof value === 'object' && value !== null && !Array.isArray(value) &&
      typeof config[key] === 'object' && config[key] !== null
    ) {
      config[key] = {
        ...(config[key] as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      };
    } else {
      config[key] = value;
    }
  }

  return config;
}
