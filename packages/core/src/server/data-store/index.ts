function getSheet(tableName: string) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tableName);
  if (!sheet) throw new Error(`Table '${tableName}' not found`);
  return sheet;
}

function getHeaders(sheet: GoogleAppsScript.Spreadsheet.Sheet): string[] {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] as string[];
}

/** Read only a single column (data rows, no header) and return 1-based row numbers that match `value`. */
function findMatchingRowNumbers(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  colIndex: number,
  value: unknown,
): number[] {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  // Read only the target column for data rows — avoids pulling all columns
  const colData = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getValues();
  const matches: number[] = [];
  for (let i = 0; i < colData.length; i++) {
    if (String(colData[i][0]) === String(value)) {
      matches.push(i + 2); // 1-based sheet row (skip header)
    }
  }
  return matches;
}

/** Convert a single sheet row into a record keyed by headers. */
function rowToRecord(headers: string[], rowData: unknown[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  headers.forEach((h, i) => {
    if (h && String(h).trim()) record[h] = rowData[i];
  });
  return record;
}

export const DataStore = {
  getAll<T = Record<string, unknown>>(tableName: string): T[] {
    const sheet = getSheet(tableName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const allData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const headers = allData[0] as string[];
    return allData.slice(1).map((row) => rowToRecord(headers, row) as T);
  },

  findBy<T = Record<string, unknown>>(tableName: string, field: string, value: unknown): T[] {
    const sheet = getSheet(tableName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const headers = getHeaders(sheet);
    const colIndex = headers.indexOf(field);
    if (colIndex === -1) return [];

    // Read only the filter column, then fetch full rows for matches only
    const matchingRows = findMatchingRowNumbers(sheet, colIndex, value);
    if (matchingRows.length === 0) return [];

    const numCols = headers.length;
    return matchingRows.map((rowNum) => {
      const rowData = sheet.getRange(rowNum, 1, 1, numCols).getValues()[0];
      return rowToRecord(headers, rowData) as T;
    });
  },

  findById<T = Record<string, unknown>>(tableName: string, id: string): T | null {
    const sheet = getSheet(tableName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return null;

    const headers = getHeaders(sheet);
    const colIndex = headers.indexOf('id');
    if (colIndex === -1) return null;

    // Read only the 'id' column, stop at first match
    const colData = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < colData.length; i++) {
      if (String(colData[i][0]) === String(id)) {
        const rowData = sheet.getRange(i + 2, 1, 1, headers.length).getValues()[0];
        return rowToRecord(headers, rowData) as T;
      }
    }
    return null;
  },

  insert(tableName: string, rows: Record<string, unknown> | Record<string, unknown>[]): number {
    const arr = Array.isArray(rows) ? rows : [rows];
    const sheet = getSheet(tableName);
    const headers = getHeaders(sheet);
    const startRow = sheet.getLastRow() + 1;
    const data = arr.map((r) => headers.map((h) => r[h] ?? ''));
    if (data.length > 0) {
      sheet.getRange(startRow, 1, data.length, headers.length).setValues(data);
    }
    return arr.length;
  },

  update(tableName: string, keyField: string, keyValue: unknown, updates: Record<string, unknown>): number {
    const sheet = getSheet(tableName);
    const headers = getHeaders(sheet);
    const keyCol = headers.indexOf(keyField);
    if (keyCol === -1) throw new Error(`Field '${keyField}' not found in '${tableName}'`);

    // Read only the key column, then update only matching rows
    const matchingRows = findMatchingRowNumbers(sheet, keyCol, keyValue);
    if (matchingRows.length === 0) return 0;

    const numCols = headers.length;
    for (const rowNum of matchingRows) {
      const rowData = sheet.getRange(rowNum, 1, 1, numCols).getValues()[0];
      const record = rowToRecord(headers, rowData);
      const merged = { ...record, ...updates };
      const row = headers.map((h) => merged[h] ?? '');
      sheet.getRange(rowNum, 1, 1, numCols).setValues([row]);
    }
    return matchingRows.length;
  },

  remove(tableName: string, keyField: string, keyValue: unknown): number {
    const sheet = getSheet(tableName);
    const headers = getHeaders(sheet);
    const keyCol = headers.indexOf(keyField);
    if (keyCol === -1) throw new Error(`Field '${keyField}' not found in '${tableName}'`);

    // Read only the key column to find rows to delete
    const matchingRows = findMatchingRowNumbers(sheet, keyCol, keyValue);
    if (matchingRows.length === 0) return 0;

    // Delete bottom-to-top to keep indices valid
    for (let i = matchingRows.length - 1; i >= 0; i--) {
      sheet.deleteRow(matchingRows[i]);
    }
    return matchingRows.length;
  },

  ensureTable(tableName: string, headers: string[]): void {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(tableName);
    if (!sheet) {
      sheet = ss.insertSheet(tableName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      return;
    }
    const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] as string[];
    const missing = headers.filter((h) => !existing.includes(h));
    if (missing.length > 0) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    }
  },
};
