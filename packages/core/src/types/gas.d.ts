declare const SpreadsheetApp: {
  getActiveSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet;
};

declare const CacheService: {
  getScriptCache(): GoogleAppsScript.Cache.Cache;
  getUserCache(): GoogleAppsScript.Cache.Cache;
};

declare const PropertiesService: {
  getScriptProperties(): GoogleAppsScript.Properties.Properties;
};

declare const MailApp: {
  sendEmail(recipient: string, subject: string, body: string, options?: { htmlBody?: string }): void;
};

declare const Utilities: {
  getUuid(): string;
  base64Encode(data: string | number[]): string;
  base64Decode(data: string): number[];
  formatDate(date: Date, timeZone: string, format: string): string;
};

declare const Session: {
  getActiveUser(): { getEmail(): string };
  getScriptTimeZone(): string;
};

declare const HtmlService: {
  createTemplateFromFile(filename: string): GoogleAppsScript.HTML.Template;
  createHtmlOutput(html: string): GoogleAppsScript.HTML.HtmlOutput;
  createHtmlOutputFromFile(filename: string): GoogleAppsScript.HTML.HtmlOutput;
  XFrameOptionsMode: { ALLOWALL: unknown };
};

declare const Logger: {
  log(msg: string): void;
};

declare namespace GoogleAppsScript {
  namespace Spreadsheet {
    interface Spreadsheet {
      getSheetByName(name: string): Sheet | null;
      insertSheet(name: string): Sheet;
    }
    interface Sheet {
      getLastRow(): number;
      getLastColumn(): number;
      getRange(row: number, col: number, numRows?: number, numCols?: number): Range;
      deleteRow(row: number): void;
      appendRow(values: unknown[]): void;
      getName(): string;
    }
    interface Range {
      getValues(): unknown[][];
      setValues(values: unknown[][]): void;
    }
  }
  namespace Cache {
    interface Cache {
      get(key: string): string | null;
      put(key: string, value: string, expirationInSeconds: number): void;
      remove(key: string): void;
      removeAll(keys: string[]): void;
    }
  }
  namespace Properties {
    interface Properties {
      getProperty(key: string): string | null;
      setProperty(key: string, value: string): void;
    }
  }
  namespace HTML {
    interface Template {
      evaluate(): HtmlOutput;
    }
    interface HtmlOutput {
      getContent(): string;
      setTitle(title: string): HtmlOutput;
      addMetaTag(name: string, content: string): HtmlOutput;
      setXFrameOptionsMode(mode: unknown): HtmlOutput;
    }
  }
}
