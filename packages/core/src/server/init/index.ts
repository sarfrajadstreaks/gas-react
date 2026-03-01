export interface AppConfig {
  title: string;
  htmlEntry?: string;
  metaTags?: Record<string, string>;
}

export interface GASApp {
  doGet(e?: unknown): GoogleAppsScript.HTML.HtmlOutput;
}

export function initApp(config: AppConfig): GASApp {
  const { title, htmlEntry = 'index', metaTags } = config;

  return {
    doGet(_e?: unknown) {
      try {
        let output = HtmlService.createHtmlOutputFromFile(htmlEntry)
          .setTitle(title)
          .addMetaTag('viewport', 'width=device-width, initial-scale=1')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

        if (metaTags) {
          for (const [name, content] of Object.entries(metaTags)) {
            output = output.addMetaTag(name, content);
          }
        }

        return output;
      } catch (error) {
        return HtmlService.createHtmlOutput(
          `<h1>Error</h1><p>${error}</p>`,
        ).addMetaTag('viewport', 'width=device-width, initial-scale=1');
      }
    },
  };
}
