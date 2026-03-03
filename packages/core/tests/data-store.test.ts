import { describe, it, expect, beforeEach } from 'vitest';
import { DataStore } from '../src/server/data-store/index';

// ── Mock SpreadsheetApp ──────────────────────────────────────────────
type Row = unknown[];

function createMockSheet(name: string, initialData: Row[] = []) {
  const data: Row[] = [...initialData];

  return {
    getName: () => name,
    getLastRow: () => data.length,
    getLastColumn: () => (data.length > 0 ? data[0].length : 0),
    getRange: (row: number, col: number, numRows = 1, numCols = 1) => {
      const r = row - 1;
      const c = col - 1;
      const nr = numRows;
      const nc = numCols;
      return {
        getValues: () =>
          data.slice(r, r + nr).map((rowData) => rowData.slice(c, c + nc)),
        setValues: (values: unknown[][]) => {
          for (let i = 0; i < values.length; i++) {
            // Expand data array if needed
            while (data.length <= r + i) data.push(new Array(nc).fill(''));
            for (let j = 0; j < values[i].length; j++) {
              if (!data[r + i]) data[r + i] = new Array(nc).fill('');
              data[r + i][c + j] = values[i][j];
            }
          }
        },
      };
    },
    deleteRow: (row: number) => {
      data.splice(row - 1, 1);
    },
    appendRow: (values: unknown[]) => {
      data.push(values);
    },
    // Expose for test assertions
    _data: data,
  };
}

let sheetsMap: Record<string, ReturnType<typeof createMockSheet>> = {};

(globalThis as Record<string, unknown>).SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: (name: string) => sheetsMap[name] ?? null,
    insertSheet: (name: string) => {
      const sheet = createMockSheet(name);
      sheetsMap[name] = sheet;
      return sheet;
    },
  }),
};

// ── Helpers ──────────────────────────────────────────────────────────
function seedSheet(name: string, headers: string[], rows: Record<string, unknown>[]) {
  const headerRow = headers;
  const dataRows = rows.map((r) => headers.map((h) => r[h] ?? ''));
  sheetsMap[name] = createMockSheet(name, [headerRow, ...dataRows]);
}

// ── Tests ────────────────────────────────────────────────────────────
describe('DataStore.getAll', () => {
  beforeEach(() => {
    sheetsMap = {};
  });

  it('returns all rows as typed objects', () => {
    seedSheet('users', ['id', 'name', 'role'], [
      { id: '1', name: 'Alice', role: 'admin' },
      { id: '2', name: 'Bob', role: 'viewer' },
    ]);

    const users = DataStore.getAll<{ id: string; name: string; role: string }>('users');
    expect(users).toHaveLength(2);
    expect(users[0]).toEqual({ id: '1', name: 'Alice', role: 'admin' });
    expect(users[1]).toEqual({ id: '2', name: 'Bob', role: 'viewer' });
  });

  it('returns empty array for empty sheet (headers only)', () => {
    seedSheet('empty', ['id', 'name'], []);
    // Sheet with headers only has lastRow = 1, which triggers early return
    const result = DataStore.getAll('empty');
    expect(result).toEqual([]);
  });

  it('converts Date objects to ISO strings (google.script.run safety)', () => {
    const checkIn = new Date('2026-01-15T14:00:00.000Z');
    const checkOut = new Date('2026-01-18T11:00:00.000Z');
    seedSheet('reservations', ['id', 'guest', 'checkIn', 'checkOut'], [
      { id: '1', guest: 'Alice', checkIn, checkOut },
    ]);

    const rows = DataStore.getAll<{
      id: string;
      guest: string;
      checkIn: string;
      checkOut: string;
    }>('reservations');

    expect(rows).toHaveLength(1);
    expect(rows[0].checkIn).toBe('2026-01-15T14:00:00.000Z');
    expect(rows[0].checkOut).toBe('2026-01-18T11:00:00.000Z');
    expect(typeof rows[0].checkIn).toBe('string');
  });

  it('throws when sheet does not exist', () => {
    expect(() => DataStore.getAll('nonexistent')).toThrow("Table 'nonexistent' not found");
  });
});

describe('DataStore.findBy', () => {
  beforeEach(() => {
    sheetsMap = {};
    seedSheet('users', ['id', 'name', 'role'], [
      { id: '1', name: 'Alice', role: 'admin' },
      { id: '2', name: 'Bob', role: 'admin' },
      { id: '3', name: 'Carol', role: 'viewer' },
    ]);
  });

  it('filters rows by field value', () => {
    const admins = DataStore.findBy('users', 'role', 'admin');
    expect(admins).toHaveLength(2);
    expect(admins.map((a: Record<string, unknown>) => a.name)).toEqual(['Alice', 'Bob']);
  });

  it('returns empty array when no match', () => {
    const editors = DataStore.findBy('users', 'role', 'editor');
    expect(editors).toEqual([]);
  });
});

describe('DataStore.findById', () => {
  beforeEach(() => {
    sheetsMap = {};
    seedSheet('users', ['id', 'name'], [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);
  });

  it('returns the matching row', () => {
    const user = DataStore.findById<{ id: string; name: string }>('users', '2');
    expect(user).toEqual({ id: '2', name: 'Bob' });
  });

  it('returns null when not found', () => {
    const user = DataStore.findById('users', '99');
    expect(user).toBeNull();
  });

  it('converts Date objects to ISO strings', () => {
    const createdAt = new Date('2026-03-01T10:00:00.000Z');
    seedSheet('items', ['id', 'name', 'createdAt'], [
      { id: '1', name: 'Widget', createdAt },
    ]);

    const item = DataStore.findById<{ id: string; createdAt: string }>('items', '1');
    expect(item?.createdAt).toBe('2026-03-01T10:00:00.000Z');
    expect(typeof item?.createdAt).toBe('string');
  });
});

describe('DataStore.insert', () => {
  beforeEach(() => {
    sheetsMap = {};
    seedSheet('users', ['id', 'name'], [{ id: '1', name: 'Alice' }]);
  });

  it('appends a single row', () => {
    const count = DataStore.insert('users', { id: '2', name: 'Bob' });
    expect(count).toBe(1);
    const all = DataStore.getAll<{ id: string; name: string }>('users');
    expect(all).toHaveLength(2);
    expect(all[1].name).toBe('Bob');
  });

  it('appends multiple rows', () => {
    const count = DataStore.insert('users', [
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Carol' },
    ]);
    expect(count).toBe(2);
    expect(DataStore.getAll('users')).toHaveLength(3);
  });
});

describe('DataStore.update', () => {
  beforeEach(() => {
    sheetsMap = {};
    seedSheet('users', ['id', 'name', 'role'], [
      { id: '1', name: 'Alice', role: 'viewer' },
      { id: '2', name: 'Bob', role: 'viewer' },
    ]);
  });

  it('updates matching rows in-place', () => {
    const count = DataStore.update('users', 'id', '1', { role: 'admin' });
    expect(count).toBe(1);
    const user = DataStore.findById<{ id: string; role: string }>('users', '1');
    expect(user?.role).toBe('admin');
  });

  it('returns 0 when no rows match', () => {
    const count = DataStore.update('users', 'id', '99', { role: 'admin' });
    expect(count).toBe(0);
  });

  it('throws when field does not exist', () => {
    expect(() => DataStore.update('users', 'email', 'x', {})).toThrow(
      "Field 'email' not found",
    );
  });
});

describe('DataStore.remove', () => {
  beforeEach(() => {
    sheetsMap = {};
    seedSheet('users', ['id', 'name'], [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Carol' },
    ]);
  });

  it('removes matching rows', () => {
    const count = DataStore.remove('users', 'id', '2');
    expect(count).toBe(1);
    const all = DataStore.getAll<{ id: string; name: string }>('users');
    expect(all).toHaveLength(2);
    expect(all.map((u) => u.id)).toEqual(['1', '3']);
  });

  it('returns 0 when no rows match', () => {
    const count = DataStore.remove('users', 'id', '99');
    expect(count).toBe(0);
  });
});

describe('DataStore.ensureTable', () => {
  beforeEach(() => {
    sheetsMap = {};
  });

  it('creates a new sheet with headers if missing', () => {
    DataStore.ensureTable('products', ['id', 'name', 'price']);
    expect(sheetsMap['products']).toBeDefined();
    const all = DataStore.getAll('products');
    expect(all).toEqual([]);
  });

  it('adds missing headers to existing sheet', () => {
    seedSheet('products', ['id', 'name'], []);
    DataStore.ensureTable('products', ['id', 'name', 'price', 'category']);
    // Should have added 'price' and 'category' columns
    const sheet = sheetsMap['products'];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    expect(headers).toContain('price');
    expect(headers).toContain('category');
  });
});
