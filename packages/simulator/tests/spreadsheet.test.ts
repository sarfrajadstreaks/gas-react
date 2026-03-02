import { describe, it, expect, beforeEach } from 'vitest';
import { createSpreadsheetAppMock } from '../src/mocks/spreadsheet';
import type { SpreadsheetData } from '../src/data-source/types';

function makeSheets(): SpreadsheetData {
  return new Map([
    [
      'users',
      [
        ['id', 'name', 'email'],
        ['1', 'Alice', 'alice@test.com'],
        ['2', 'Bob', 'bob@test.com'],
      ],
    ],
  ]);
}

describe('SpreadsheetApp mock', () => {
  let sheets: SpreadsheetData;
  let app: ReturnType<typeof createSpreadsheetAppMock>;
  let mutationCount: number;

  beforeEach(() => {
    sheets = makeSheets();
    mutationCount = 0;
    app = createSpreadsheetAppMock(sheets, () => { mutationCount++; });
  });

  it('returns spreadsheet with getActiveSpreadsheet', () => {
    const ss = app.getActiveSpreadsheet();
    expect(ss).toBeDefined();
    expect(typeof ss.getSheetByName).toBe('function');
  });

  it('returns null for non-existent sheet', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('nope');
    expect(sheet).toBeNull();
  });

  it('returns sheet for existing sheet', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users');
    expect(sheet).not.toBeNull();
    expect(sheet!.getName()).toBe('users');
  });

  it('getLastRow returns total rows including header', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    expect(sheet.getLastRow()).toBe(3);
  });

  it('getLastColumn returns column count', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    expect(sheet.getLastColumn()).toBe(3);
  });

  it('getRange().getValues() reads data correctly', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    const values = sheet.getRange(1, 1, 3, 3).getValues();
    expect(values).toEqual([
      ['id', 'name', 'email'],
      ['1', 'Alice', 'alice@test.com'],
      ['2', 'Bob', 'bob@test.com'],
    ]);
  });

  it('getRange().getValues() reads a subset', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    const values = sheet.getRange(2, 2, 1, 2).getValues();
    expect(values).toEqual([['Alice', 'alice@test.com']]);
  });

  it('setValues writes data in place', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.getRange(2, 2, 1, 1).setValues([['Charlie']]);
    const values = sheet.getRange(2, 1, 1, 3).getValues();
    expect(values).toEqual([['1', 'Charlie', 'alice@test.com']]);
  });

  it('appendRow adds a row', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.appendRow(['3', 'Charlie', 'charlie@test.com']);
    expect(sheet.getLastRow()).toBe(4);
    const values = sheet.getRange(4, 1, 1, 3).getValues();
    expect(values).toEqual([['3', 'Charlie', 'charlie@test.com']]);
  });

  it('deleteRow removes a row', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.deleteRow(3); // remove Bob
    expect(sheet.getLastRow()).toBe(2);
    const values = sheet.getRange(1, 1, 2, 3).getValues();
    expect(values).toEqual([
      ['id', 'name', 'email'],
      ['1', 'Alice', 'alice@test.com'],
    ]);
  });

  it('insertSheet creates a new empty sheet', () => {
    const ss = app.getActiveSpreadsheet();
    const newSheet = ss.insertSheet('products');
    expect(newSheet.getName()).toBe('products');
    expect(newSheet.getLastRow()).toBe(0);
    // Also available via getSheetByName
    expect(ss.getSheetByName('products')).not.toBeNull();
  });

  it('insertSheet throws for duplicate', () => {
    const ss = app.getActiveSpreadsheet();
    expect(() => ss.insertSheet('users')).toThrow("Sheet 'users' already exists");
  });

  it('mutations are reflected in the underlying SpreadsheetData', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.appendRow(['3', 'Charlie', 'charlie@test.com']);
    // Verify the raw data changed
    expect(sheets.get('users')!.length).toBe(4);
  });

  it('onMutate is called on appendRow', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.appendRow(['3', 'Charlie', 'charlie@test.com']);
    expect(mutationCount).toBe(1);
  });

  it('onMutate is called on setValues', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.getRange(2, 2, 1, 1).setValues([['Updated']]);
    expect(mutationCount).toBe(1);
  });

  it('onMutate is called on deleteRow', () => {
    const sheet = app.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.deleteRow(2);
    expect(mutationCount).toBe(1);
  });

  it('onMutate is called on insertSheet', () => {
    app.getActiveSpreadsheet().insertSheet('products');
    expect(mutationCount).toBe(1);
  });
});
