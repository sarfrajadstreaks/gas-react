/**
 * Sheet Core — Low-level Google Sheets CRUD
 *
 * Zero business logic. Reads/writes raw data using headers as field names.
 * The Repository layer above handles schema validation and caching.
 */

/** Get a sheet by logical table name */
export function getSheet(tableName: string) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(tableName);
}

/** Read all rows as objects keyed by header names */
export function getAll(tableName: string): Record<string, unknown>[] {
  const sheet = getSheet(tableName);
  if (!sheet) throw new Error(`Table '${tableName}' not found`);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const allData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = allData[0] as string[];
  const dataRows = allData.slice(1);

  return dataRows.map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      if (header && String(header).trim() !== '') {
        record[header] = row[i];
      }
    });
    return record;
  });
}

/** Find rows where `fieldName` matches `value`. Returns records + 1-based row indices. */
export function getWhere(
  tableName: string,
  fieldName: string,
  value: unknown | ((cellValue: unknown) => boolean)
): Array<{ rowIndex: number; record: Record<string, unknown> }> {
  const records = getAll(tableName);
  const isFunction = typeof value === 'function';

  return records.reduce<Array<{ rowIndex: number; record: Record<string, unknown> }>>(
    (acc, record, i) => {
      const cellValue = record[fieldName];
      const matches = isFunction
        ? (value as (v: unknown) => boolean)(cellValue)
        : String(cellValue) === String(value);
      if (matches) acc.push({ rowIndex: i + 2, record });
      return acc;
    },
    []
  );
}

/** Insert multiple rows at once */
export function insertMany(
  tableName: string,
  records: Record<string, unknown>[]
): number {
  const sheet = getSheet(tableName);
  if (!sheet) throw new Error(`Table '${tableName}' not found`);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] as string[];
  const startRow = sheet.getLastRow() + 1;

  const rows = records.map((record) =>
    headers.map((header) => record[header] ?? '')
  );

  if (rows.length > 0) {
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
  }

  return startRow;
}

/** Overwrite a single row */
export function updateRow(
  tableName: string,
  rowIndex: number,
  record: Record<string, unknown>
): void {
  const sheet = getSheet(tableName);
  if (!sheet) throw new Error(`Table '${tableName}' not found`);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] as string[];
  const row = headers.map((header) => record[header] ?? '');

  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
}

/** Delete a single row by index */
export function deleteRow(tableName: string, rowIndex: number): void {
  const sheet = getSheet(tableName);
  if (!sheet) throw new Error(`Table '${tableName}' not found`);
  sheet.deleteRow(rowIndex);
}

/** Ensure a sheet exists with the given headers */
export function ensureHeaders(tableName: string, expectedHeaders: string[]) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(tableName);

  if (!sheet) {
    sheet = ss.insertSheet(tableName);
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return sheet;
  }

  // Check for missing columns
  const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] as string[];
  const missing = expectedHeaders.filter((h) => !existing.includes(h));

  if (missing.length > 0) {
    const startCol = existing.length + 1;
    sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
  }

  return sheet;
}
