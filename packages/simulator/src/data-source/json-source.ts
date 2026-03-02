import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import type { SheetData, SpreadsheetData } from './types.js';

/**
 * Load spreadsheet data from a directory of JSON files.
 * Each `.json` file represents one sheet (filename without extension = sheet name).
 * File content must be a 2D array: first row = headers, rest = data rows.
 */
export function loadJsonSource(dataDir: string): SpreadsheetData {
  const sheets: SpreadsheetData = new Map();

  if (!existsSync(dataDir)) {
    throw new Error(`Data directory not found: ${dataDir}`);
  }

  const files = readdirSync(dataDir).filter((f) => extname(f) === '.json');

  for (const file of files) {
    const sheetName = basename(file, '.json');
    const raw = readFileSync(join(dataDir, file), 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error(
        `${file}: expected a 2D array (first row = headers). Got ${typeof parsed}`,
      );
    }

    sheets.set(sheetName, parsed as SheetData);
  }

  return sheets;
}

/**
 * Persist the current in-memory data back to the JSON directory.
 * Creates the directory if it doesn't exist.
 */
export function persistJsonSource(dataDir: string, sheets: SpreadsheetData): void {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  for (const [name, data] of sheets) {
    const filePath = join(dataDir, `${name}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }
}
