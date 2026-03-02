/**
 * Shared types for spreadsheet data sources.
 *
 * Data is stored as raw 2D arrays (matching Google Sheets `getValues()` format):
 *   - First row is headers
 *   - Remaining rows are data
 *
 * Example JSON file (users.json):
 * [
 *   ["id", "name", "email"],
 *   ["1",  "Alice", "alice@test.com"],
 *   ["2",  "Bob",   "bob@test.com"]
 * ]
 */

/** A single sheet's data: 2D array where row 0 = headers */
export type SheetData = unknown[][];

/** All sheets keyed by sheet name */
export type SpreadsheetData = Map<string, SheetData>;

/** Options for creating a data source */
export interface DataSourceOptions {
  /** Directory containing JSON files (one per sheet, filename = sheet name) */
  dataDir: string;
}
