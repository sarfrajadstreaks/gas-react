import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSimulator, type Simulator } from '../src/index';

const TMP_DIR = join(__dirname, '__tmp_sim__');

function setupData(files: Record<string, unknown>) {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    writeFileSync(join(TMP_DIR, `${name}.json`), JSON.stringify(data), 'utf-8');
  }
}

function cleanup() {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
}

describe('createSimulator', () => {
  let sim: Simulator;

  beforeEach(() => {
    setupData({
      users: [
        ['id', 'name', 'email'],
        ['1', 'Alice', 'alice@test.com'],
        ['2', 'Bob', 'bob@test.com'],
      ],
    });
    sim = createSimulator({
      dataDir: TMP_DIR,
      userEmail: 'test@dev.com',
      timeZone: 'America/Chicago',
    });
  });

  afterEach(() => {
    sim.removeGlobals();
    cleanup();
  });

  it('loads JSON data into sheets', () => {
    expect(sim.sheets.size).toBe(1);
    expect(sim.sheets.has('users')).toBe(true);
  });

  it('installGlobals sets globals on globalThis', () => {
    sim.installGlobals();

    const g = globalThis as Record<string, unknown>;
    expect(g.SpreadsheetApp).toBe(sim.mocks.SpreadsheetApp);
    expect(g.CacheService).toBe(sim.mocks.CacheService);
    expect(g.PropertiesService).toBe(sim.mocks.PropertiesService);
    expect(g.Logger).toBe(sim.mocks.Logger);
    expect(g.Session).toBe(sim.mocks.Session);
    expect(g.Utilities).toBe(sim.mocks.Utilities);
    expect(g.MailApp).toBe(sim.mocks.MailApp);
    expect(g.HtmlService).toBe(sim.mocks.HtmlService);
  });

  it('removeGlobals cleans up globalThis', () => {
    sim.installGlobals();
    sim.removeGlobals();

    const g = globalThis as Record<string, unknown>;
    expect(g.SpreadsheetApp).toBeUndefined();
    expect(g.CacheService).toBeUndefined();
  });

  it('SpreadsheetApp mock works with loaded data', () => {
    sim.installGlobals();

    const g = globalThis as Record<string, unknown>;
    const ssApp = g.SpreadsheetApp as typeof sim.mocks.SpreadsheetApp;
    const sheet = ssApp.getActiveSpreadsheet().getSheetByName('users');
    expect(sheet).not.toBeNull();
    expect(sheet!.getLastRow()).toBe(3);

    const vals = sheet!.getRange(1, 1, 3, 3).getValues();
    expect(vals[0]).toEqual(['id', 'name', 'email']);
    expect(vals[1]).toEqual(['1', 'Alice', 'alice@test.com']);
  });

  it('Session mock uses configured email and timezone', () => {
    expect(sim.mocks.Session.getActiveUser().getEmail()).toBe('test@dev.com');
    expect(sim.mocks.Session.getScriptTimeZone()).toBe('America/Chicago');
  });
});

describe('auto-persist: mutations write back to JSON', () => {
  let sim: Simulator;

  beforeEach(() => {
    setupData({
      users: [
        ['id', 'name', 'email'],
        ['1', 'Alice', 'alice@test.com'],
      ],
    });
    sim = createSimulator({ dataDir: TMP_DIR });
    sim.installGlobals();
  });

  afterEach(() => {
    sim.removeGlobals();
    cleanup();
  });

  function readJsonFile(name: string): unknown {
    return JSON.parse(readFileSync(join(TMP_DIR, `${name}.json`), 'utf-8'));
  }

  it('appendRow persists to JSON', () => {
    const sheet = sim.mocks.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.appendRow(['2', 'Bob', 'bob@test.com']);

    const onDisk = readJsonFile('users');
    expect(onDisk).toEqual([
      ['id', 'name', 'email'],
      ['1', 'Alice', 'alice@test.com'],
      ['2', 'Bob', 'bob@test.com'],
    ]);
  });

  it('setValues persists to JSON', () => {
    const sheet = sim.mocks.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.getRange(2, 2, 1, 1).setValues([['Updated']]);

    const onDisk = readJsonFile('users');
    expect((onDisk as unknown[][])[1][1]).toBe('Updated');
  });

  it('deleteRow persists to JSON', () => {
    const sheet = sim.mocks.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.deleteRow(2);

    const onDisk = readJsonFile('users');
    expect(onDisk).toEqual([['id', 'name', 'email']]);
  });

  it('insertSheet creates new JSON file', () => {
    sim.mocks.SpreadsheetApp.getActiveSpreadsheet().insertSheet('products');
    expect(existsSync(join(TMP_DIR, 'products.json'))).toBe(true);
  });
});

describe('simulator integration: DataStore-like flow', () => {
  let sim: Simulator;

  beforeEach(() => {
    setupData({
      users: [
        ['id', 'name', 'email'],
        ['1', 'Alice', 'alice@test.com'],
      ],
    });
    sim = createSimulator({ dataDir: TMP_DIR });
    sim.installGlobals();
  });

  afterEach(() => {
    sim.removeGlobals();
    cleanup();
  });

  it('simulates DataStore.getAll pattern', () => {
    const g = globalThis as Record<string, unknown>;
    const ssApp = g.SpreadsheetApp as typeof sim.mocks.SpreadsheetApp;
    const sheet = ssApp.getActiveSpreadsheet().getSheetByName('users')!;
    const lastRow = sheet.getLastRow();
    const allData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const headers = allData[0] as string[];
    const records = allData.slice(1).map((row) => {
      const record: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        if (h && String(h).trim()) record[h] = (row as unknown[])[i];
      });
      return record;
    });

    expect(records).toEqual([
      { id: '1', name: 'Alice', email: 'alice@test.com' },
    ]);
  });

  it('simulates DataStore.insert then survives re-read', () => {
    const sheet = sim.mocks.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users')!;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] as string[];

    const newRow = { id: '2', name: 'Bob', email: 'bob@test.com' };
    const row = headers.map((h) => newRow[h as keyof typeof newRow] ?? '');
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, 1, headers.length).setValues([row]);

    // Re-create simulator from same dir — data should be there
    const sim2 = createSimulator({ dataDir: TMP_DIR });
    const sheet2 = sim2.mocks.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users')!;
    expect(sheet2.getLastRow()).toBe(3);
  });

  it('simulates DataStore.remove pattern', () => {
    const sheet = sim.mocks.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users')!;
    sheet.deleteRow(2);
    expect(sheet.getLastRow()).toBe(1);
  });
});
