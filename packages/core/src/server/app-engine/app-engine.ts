/**
 * App Engine — The GAS entry points.
 *
 * Creates `doGet` (serves the SPA) and `runLibraryFunction` (RPC bridge).
 * These become global functions after esbuild bundles the server code.
 */

import type { GASFrameworkConfig } from '../../types/config';

export interface AppEngine {
  /** GAS web app entry point — serves the HTML shell */
  doGet(e?: unknown): GoogleAppsScript.HTML.HtmlOutput;

  /** RPC bridge — client calls this via google.script.run */
  runLibraryFunction(funcName: string, args?: unknown[]): unknown;
}

/**
 * Create the main GAS entry points.
 *
 * @param config      - App configuration
 * @param functions   - Map of function names to implementations that should be
 *                      callable from the client via `executeFn(name, args)`.
 * @param htmlEntry   - The HtmlService template file path for the SPA shell.
 *                      Defaults to 'index' (i.e. index.html).
 */
export function createAppEngine(
  config: GASFrameworkConfig,
  functions: Record<string, (...args: unknown[]) => unknown>,
  htmlEntry = 'index'
): AppEngine {
  return {
    doGet(_e?: unknown) {
      try {
        const template = HtmlService.createTemplateFromFile(htmlEntry);
        return template
          .evaluate()
          .setTitle(config.name)
          .addMetaTag('viewport', 'width=device-width, initial-scale=1')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      } catch (error) {
        return HtmlService.createHtmlOutput(
          `<h1>Error</h1><p>${error}</p>`
        ).addMetaTag('viewport', 'width=device-width, initial-scale=1');
      }
    },

    runLibraryFunction(funcName: string, args?: unknown[]) {
      const fn = functions[funcName];
      if (typeof fn !== 'function') {
        throw new Error(`Function '${funcName}' does not exist`);
      }
      return fn(...(args || []));
    },
  };
}
