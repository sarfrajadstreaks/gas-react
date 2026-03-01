export declare function isLocalDev(): boolean;

export interface GASPluginOptions {
  pagePrefix?: string;
  appTitle?: string;
}

export declare function gasPlugin(options?: GASPluginOptions): {
  name: string;
  enforce: 'post';
};

export interface GASViteOptions {
  clientRoot?: string;
  outDir?: string;
  devServerPort?: number;
  devPort?: number;
  aliases?: Record<string, string>;
  plugins?: unknown[];
  appTitle?: string;
  vite?: Record<string, unknown>;
}

export declare function createGASViteConfig(
  options?: GASViteOptions
): Promise<Record<string, unknown>>;
