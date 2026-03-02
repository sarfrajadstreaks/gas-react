/**
 * webpack-plugin-gas-react
 *
 * Drop-in webpack configuration + plugin for deploying React apps to Google Apps Script.
 */

import path from 'node:path';
import { createRequire } from 'node:module';

export { GASWebpackPlugin } from './gas-webpack-plugin';
export type { GASWebpackPluginOptions } from './gas-webpack-plugin';

export function isLocalDev(): boolean {
  return process.env.GAS_LOCAL === 'true';
}

export interface GASWebpackOptions {
  /** Root directory of client code (default: "src/client") */
  clientRoot?: string;
  /** Output directory (default: "dist") */
  outDir?: string;
  /** Dev server port for local development (default: 3001) */
  devServerPort?: number;
  /** Webpack dev server port (default: 8080) */
  devPort?: number;
  /** Path aliases (e.g. { "@": "src" }) */
  aliases?: Record<string, string>;
  /** Extra webpack plugins */
  plugins?: unknown[];
  /** Title for the GAS web app */
  appTitle?: string;
  /** Path to server entry file (e.g. "src/server/index.ts") */
  serverEntry?: string;
  /** Additional webpack config overrides */
  webpack?: Record<string, unknown>;
}

/**
 * Create a full webpack configuration for GAS React apps.
 *
 * In production (default): bundles and transforms for GAS deployment.
 * In dev mode (GAS_LOCAL=true): runs a normal webpack dev server with
 * dev mode flags set so gas-react-core/client routes to local server.
 */
export async function createGASWebpackConfig(
  options: GASWebpackOptions = {},
): Promise<Record<string, unknown>> {
  const {
    clientRoot = 'src/client',
    outDir = 'dist',
    devServerPort = 3001,
    devPort = 8080,
    aliases = {},
    plugins: extraPlugins = [],
    appTitle = 'GAS App',
    serverEntry,
    webpack: overrides = {},
  } = options;

  const local = isLocalDev();
  const projectRoot = process.cwd();
  const entryDir = path.resolve(projectRoot, clientRoot);

  const plugins: unknown[] = [];

  // Try to load html-webpack-plugin from the consumer's project
  // (not from this package — it's a peer dependency)
  type HtmlPluginConstructor = new (opts: Record<string, unknown>) => unknown;
  let HtmlWebpackPlugin: HtmlPluginConstructor | null = null;
  try {
    const consumerRequire = createRequire(path.resolve(projectRoot, 'package.json'));
    HtmlWebpackPlugin = consumerRequire('html-webpack-plugin') as HtmlPluginConstructor;
  } catch {
    console.warn(
      '⚠️  html-webpack-plugin not found. Install it:\n' +
      '   npm install -D html-webpack-plugin\n',
    );
  }

  if (HtmlWebpackPlugin) {
    const HtmlPlugin = HtmlWebpackPlugin;
    plugins.push(
      new HtmlPlugin({
        template: path.resolve(entryDir, 'index.html'),
        filename: 'index.html',
        inject: 'body',
      }),
    );
  }

  if (!local) {
    const { GASWebpackPlugin } = await import('./gas-webpack-plugin');
    plugins.push(new GASWebpackPlugin({ appTitle, serverEntry }));
  }

  plugins.push(...extraPlugins);

  const resolvedAliases: Record<string, string> = {
    '@': path.resolve(projectRoot, 'src'),
    ...Object.fromEntries(
      Object.entries(aliases).map(([key, val]) => [
        key,
        path.resolve(projectRoot, val),
      ]),
    ),
  };

  const config: Record<string, unknown> = {
    mode: local ? 'development' : 'production',
    entry: path.resolve(entryDir, 'index.tsx'),
    output: {
      path: path.resolve(projectRoot, outDir),
      filename: '[name].js',
      chunkFilename: '[name].js',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
      alias: resolvedAliases,
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins,
    optimization: {
      splitChunks: local
        ? undefined
        : {
            chunks: 'async',
            cacheGroups: {
              default: false,
              defaultVendors: false,
            },
          },
    },
  };

  if (local) {
    // Dev mode: set up webpack dev server with GAS dev flags
    config.devServer = {
      port: devPort,
      open: true,
      hot: true,
    };
    config.devtool = 'eval-source-map';

    // Define dev mode globals so gas-react-core/client routes to local server
    const consumerReq = createRequire(path.resolve(projectRoot, 'package.json'));
    const webpack = consumerReq('webpack') as Record<string, unknown> & { default?: Record<string, unknown>; DefinePlugin?: new (defs: Record<string, string>) => unknown };
    const webpackObj = webpack.default ?? webpack;
    const DefinePlugin = webpackObj.DefinePlugin as
      new (defs: Record<string, string>) => unknown;

    (config.plugins as unknown[]).push(
      new DefinePlugin({
        'window.__GAS_DEV_MODE__': 'true',
        'window.__GAS_DEV_SERVER__': JSON.stringify(`http://localhost:${devServerPort}`),
      }),
    );
  }

  // Apply overrides
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
