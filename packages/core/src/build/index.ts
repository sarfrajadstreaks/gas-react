/**
 * Build Utilities
 *
 * Helpers and config generators for the build pipeline.
 * These run in Node.js at build time — not in GAS or the browser.
 */

export interface BuildOptions {
  /** Path to server entry point */
  serverEntry: string;
  /** Path to client index.html */
  clientEntry: string;
  /** Output directory */
  outDir: string;
  /** appsscript.json path */
  appsscriptPath?: string;
}

/**
 * Default build configuration for a GAS Framework app.
 * Use this as a starting point and customize as needed.
 */
export function getDefaultBuildOptions(rootDir: string): BuildOptions {
  return {
    serverEntry: `${rootDir}/src/server/index.ts`,
    clientEntry: `${rootDir}/src/client/index.html`,
    outDir: `${rootDir}/dist`,
    appsscriptPath: `${rootDir}/appsscript.json`,
  };
}

/**
 * Generate a Vite config for the client build.
 * The client is built as a single HTML file with all JS/CSS inlined,
 * since GAS serves a single HTML page.
 */
export function getViteConfig(options: BuildOptions) {
  return {
    root: options.clientEntry.replace(/\/[^/]+$/, ''),
    build: {
      outDir: options.outDir,
      emptyOutDir: false,
      rollupOptions: {
        input: options.clientEntry,
      },
    },
    // vite-plugin-singlefile is needed to inline all assets into index.html
    // The app should install and configure it in their vite.config.ts
  };
}

/**
 * Generate esbuild options for the server build.
 * Bundles all server TS into a single Code.js with global function exports.
 */
export function getEsbuildConfig(options: BuildOptions) {
  return {
    entryPoints: [options.serverEntry],
    bundle: true,
    outfile: `${options.outDir}/Code.js`,
    format: 'esm' as const,
    target: 'es2020' as const,
    // esbuild-gas-plugin should be added by the app to convert
    // top-level exports into GAS-compatible global functions
  };
}
