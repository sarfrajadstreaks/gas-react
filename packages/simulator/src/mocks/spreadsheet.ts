import type { SpreadsheetData } from '../data-source/types.js';

/**
 * Mock implementation of Google Apps Script's SpreadsheetApp, Sheet, and Range.
 * Backed by an in-memory SpreadsheetData (Map<sheetName, 2D-array>).
 *
 * An optional `onMutate` callback is invoked after every write operation
 * (setValues, appendRow, deleteRow, insertSheet) so the caller can
 * auto-persist changes back to disk.
 */

export type OnMutateCallback = () => void;

function createRange(
  sheet: unknown[][],
  row: number,
  col: number,
  numRows: number,
  numCols: number,
  onMutate?: OnMutateCallback,
) {
  // Convert to 0-based indices
  const r = row - 1;
  const c = col - 1;

  return {
    getValues(): unknown[][] {
      const result: unknown[][] = [];
      for (let i = r; i < r + numRows; i++) {
        const rowData = sheet[i] ?? [];
        const slice: unknown[] = [];
        for (let j = c; j < c + numCols; j++) {
          slice.push(rowData[j] ?? '');
        }
        result.push(slice);
      }
      return result;
    },

    setValues(values: unknown[][]): void {
      for (let i = 0; i < numRows; i++) {
        const targetRow = r + i;
        // Ensure row exists
        while (sheet.length <= targetRow) {
          sheet.push([]);
        }
        const rowArr = sheet[targetRow] as unknown[];
        for (let j = 0; j < numCols; j++) {
          const targetCol = c + j;
          // Ensure columns exist
          while (rowArr.length <= targetCol) {
            rowArr.push('');
          }
          rowArr[targetCol] = values[i]?.[j] ?? '';
        }
      }
      onMutate?.();
    },
  };
}

function createSheet(name: string, data: unknown[][], onMutate?: OnMutateCallback) {
  return {
    getLastRow(): number {
      return data.length;
    },

    getLastColumn(): number {
      if (data.length === 0) return 0;
      return Math.max(...data.map((row) => (row as unknown[]).length));
    },

    getRange(row: number, col: number, numRows?: number, numCols?: number) {
      const nr = numRows ?? 1;
      const nc = numCols ?? 1;
      return createRange(data, row, col, nr, nc, onMutate);
    },

    deleteRow(row: number): void {
      // row is 1-based
      if (row < 1 || row > data.length) return;
      data.splice(row - 1, 1);
      onMutate?.();
    },

    appendRow(values: unknown[]): void {
      data.push([...values]);
      onMutate?.();
    },

    getName(): string {
      return name;
    },
  };
}

export function createSpreadsheetAppMock(sheets: SpreadsheetData, onMutate?: OnMutateCallback) {
  const spreadsheet = {
    getSheetByName(name: string) {
      const data = sheets.get(name);
      if (!data) return null;
      return createSheet(name, data, onMutate);
    },

    insertSheet(name: string) {
      if (sheets.has(name)) {
        throw new Error(`Sheet '${name}' already exists`);
      }
      const data: unknown[][] = [];
      sheets.set(name, data);
      onMutate?.();
      return createSheet(name, data, onMutate);
    },
  };

  return {
    getActiveSpreadsheet() {
      return spreadsheet;
    },
  };
}
