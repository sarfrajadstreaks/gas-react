export interface GASWebpackPluginOptions {
  /** Prefix for lazy-loaded page chunk GAS names (default: "page_") */
  pagePrefix?: string;
  /** Title for the GAS web app (default: "GAS App") */
  appTitle?: string;
  /** Path to the server entry file (e.g. "src/server/index.ts") */
  serverEntry?: string;
}

export declare class GASWebpackPlugin {
  constructor(options?: GASWebpackPluginOptions);
  apply(compiler: unknown): void;
}

export declare function isLocalDev(): boolean;

export interface GASWebpackOptions {
  /** Root directory of client code (default: "src/client") */
  clientRoot?: string;
  /** Output directory (default: "dist") */
  outDir?: string;
  /** Dev server port for the gas-react-core dev server proxy (default: 3001) */
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

export declare function createGASWebpackConfig(
  options?: GASWebpackOptions,
): Promise<Record<string, unknown>>;
