function getSheet(tableName: string) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tableName);
  if (!sheet) throw new Error(`Table '${tableName}' not found`);
  return sheet;
}

function readAll(tableName: string): { headers: string[]; records: Record<string, unknown>[] } {
  const sheet = getSheet(tableName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { headers: [], records: [] };

  const allData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = allData[0] as string[];
  const records = allData.slice(1).map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h && String(h).trim()) record[h] = row[i];
    });
    return record;
  });
  return { headers, records };
}

export const DataStore = {
  getAll<T = Record<string, unknown>>(tableName: string): T[] {
    return readAll(tableName).records as T[];
  },

  findBy<T = Record<string, unknown>>(tableName: string, field: string, value: unknown): T[] {
    return readAll(tableName).records.filter(
      (r) => String(r[field]) === String(value),
    ) as T[];
  },

  findById<T = Record<string, unknown>>(tableName: string, id: string): T | null {
    const results = this.findBy<T>(tableName, 'id', id);
    return results.length > 0 ? results[0] : null;
  },

  insert(tableName: string, rows: Record<string, unknown> | Record<string, unknown>[]): number {
    const arr = Array.isArray(rows) ? rows : [rows];
    const sheet = getSheet(tableName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] as string[];
    const startRow = sheet.getLastRow() + 1;
    const data = arr.map((r) => headers.map((h) => r[h] ?? ''));
    if (data.length > 0) {
      sheet.getRange(startRow, 1, data.length, headers.length).setValues(data);
    }
    return arr.length;
  },

  update(tableName: string, keyField: string, keyValue: unknown, updates: Record<string, unknown>): number {
    const sheet = getSheet(tableName);
    const allData = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    const headers = allData[0] as string[];
    const keyCol = headers.indexOf(keyField);
    if (keyCol === -1) throw new Error(`Field '${keyField}' not found in '${tableName}'`);

    let count = 0;
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][keyCol]) === String(keyValue)) {
        const record: Record<string, unknown> = {};
        headers.forEach((h, c) => { record[h] = allData[i][c]; });
        const merged = { ...record, ...updates };
        const row = headers.map((h) => merged[h] ?? '');
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
        count++;
      }
    }
    return count;
  },

  remove(tableName: string, keyField: string, keyValue: unknown): number {
    const sheet = getSheet(tableName);
    const allData = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    const headers = allData[0] as string[];
    const keyCol = headers.indexOf(keyField);
    if (keyCol === -1) throw new Error(`Field '${keyField}' not found in '${tableName}'`);

    const rowsToDelete: number[] = [];
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][keyCol]) === String(keyValue)) {
        rowsToDelete.push(i + 1);
      }
    }
    // Delete bottom-to-top to keep indices valid
    for (let i = rowsToDelete.length - 1; i >= 0; i--) {
      sheet.deleteRow(rowsToDelete[i]);
    }
    return rowsToDelete.length;
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
