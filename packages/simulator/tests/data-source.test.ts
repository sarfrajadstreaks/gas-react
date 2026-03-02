import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadJsonSource, persistJsonSource } from '../src/data-source/json-source';

const TMP_DIR = join(__dirname, '__tmp_data__');

function setupDir(files: Record<string, unknown>) {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    writeFileSync(join(TMP_DIR, name), JSON.stringify(data), 'utf-8');
  }
}

function cleanup() {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
}

describe('JSON data source', () => {
  afterEach(cleanup);

  it('loads JSON files as sheets', () => {
    setupDir({
      'users.json': [
        ['id', 'name'],
        ['1', 'Alice'],
      ],
      'products.json': [
        ['id', 'title'],
        ['p1', 'Widget'],
      ],
    });

    const sheets = loadJsonSource(TMP_DIR);
    expect(sheets.size).toBe(2);
    expect(sheets.has('users')).toBe(true);
    expect(sheets.has('products')).toBe(true);
    expect(sheets.get('users')).toEqual([
      ['id', 'name'],
      ['1', 'Alice'],
    ]);
  });

  it('throws for missing directory', () => {
    expect(() => loadJsonSource('/nonexistent/path')).toThrow('Data directory not found');
  });

  it('throws for non-array JSON', () => {
    setupDir({ 'bad.json': { key: 'value' } });
    expect(() => loadJsonSource(TMP_DIR)).toThrow('expected a 2D array');
  });

  it('ignores non-JSON files', () => {
    setupDir({ 'readme.txt': 'hi' });
    // Also add a valid JSON
    writeFileSync(
      join(TMP_DIR, 'data.json'),
      JSON.stringify([['id'], ['1']]),
      'utf-8',
    );
    const sheets = loadJsonSource(TMP_DIR);
    expect(sheets.size).toBe(1);
    expect(sheets.has('data')).toBe(true);
  });
});

describe('persistJsonSource', () => {
  afterEach(cleanup);

  it('writes sheets back to JSON files', () => {
    const sheets = new Map([
      ['users', [['id', 'name'], ['1', 'Test']]],
    ]);

    persistJsonSource(TMP_DIR, sheets);

    const reloaded = loadJsonSource(TMP_DIR);
    expect(reloaded.get('users')).toEqual([
      ['id', 'name'],
      ['1', 'Test'],
    ]);
  });
});
