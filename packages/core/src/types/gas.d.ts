/**
 * GAS Type Stubs
 *
 * These declare the global objects available in the Google Apps Script V8 runtime.
 * They allow TypeScript to compile server code without errors.
 * At runtime, GAS provides the real implementations.
 */

/* eslint-disable @typescript-eslint/no-empty-interface */

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
  sendEmail(
    recipient: string,
    subject: string,
    body: string,
    options?: { htmlBody?: string }
  ): void;
};

declare const DriveApp: {
  getFileById(id: string): GoogleAppsScript.Drive.File;
  getFolderById(id: string): GoogleAppsScript.Drive.Folder;
  getRootFolder(): GoogleAppsScript.Drive.Folder;
  createFolder(name: string): GoogleAppsScript.Drive.Folder;
};

declare const Utilities: {
  getUuid(): string;
  base64Encode(data: string | number[]): string;
  base64Decode(data: string): number[];
  computeHmacSha256Signature(value: string, key: string): number[];
  formatDate(date: Date, timeZone: string, format: string): string;
  newBlob(data: number[]): GoogleAppsScript.Base.Blob;
};

declare const Session: {
  getActiveUser(): { getEmail(): string };
  getScriptTimeZone(): string;
};

declare const HtmlService: {
  createTemplateFromFile(filename: string): GoogleAppsScript.HTML.Template;
  createHtmlOutput(html: string): GoogleAppsScript.HTML.HtmlOutput;
  XFrameOptionsMode: {
    ALLOWALL: unknown;
  };
};

declare const Logger: {
  log(msg: string): void;
};

// ─── Namespace stubs ────────────────────────────────────────────────────────

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
  namespace Drive {
    interface File {
      getBlob(): Base.Blob;
      getId(): string;
      getName(): string;
    }
    interface Folder {
      getId(): string;
      createFile(blob: Base.Blob): File;
      getFilesByName(name: string): FileIterator;
    }
    interface FileIterator {
      hasNext(): boolean;
      next(): File;
    }
  }
  namespace Base {
    interface Blob {
      getBytes(): number[];
      getContentType(): string;
      getDataAsString(): string;
      setName(name: string): Blob;
      setContentType(type: string): Blob;
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
