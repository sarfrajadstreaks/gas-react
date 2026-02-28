/**
 * App Engine — The GAS entry point.
 *
 * Creates `doGet` which serves the React SPA as a single HTML page.
 * Since esbuild bundles server code into Code.js with top-level global
 * functions, every `export function` in your server/index.ts becomes
 * directly callable via `google.script.run.functionName()` — no proxy needed.
 */

import type { GASFrameworkConfig } from '../../types/config';

export interface AppEngine {
  /** GAS web app entry point — serves the React SPA */
  doGet(e?: unknown): GoogleAppsScript.HTML.HtmlOutput;
}

/**
 * Create the GAS web app entry point.
 *
 * @param config    - App configuration
 * @param htmlEntry - The HtmlService template file path for the SPA shell.
 *                    Defaults to 'index' (i.e. index.html).
 */
export function createAppEngine(
  config: GASFrameworkConfig,
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
  };
}
