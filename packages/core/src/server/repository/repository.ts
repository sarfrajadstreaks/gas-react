import type { AppSchema, CacheConfig } from '../../types/config';
import * as SheetCore from './sheet-core';
import { validateRecord, getSchemaForTable, applyDefaults } from './schema-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Repository {
  findAll<T = Record<string, unknown>>(tableName: string): T[];
  find<T = Record<string, unknown>>(tableName: string, fieldName: string, value: unknown): T[];
  findById<T = Record<string, unknown>>(tableName: string, id: string): T[];
  insert(tableName: string, records: Record<string, unknown>[]): number;
  update(tableName: string, keyField: string, keyValue: unknown, updates: Record<string, unknown>): number;
  delete(tableName: string, keyField: string, keyValue: unknown): number;
  ensureTable(tableName: string): { success: boolean; tableName: string };
}

// ─── Cache integration ──────────────────────────────────────────────────────

let cacheEnabled = false;
let cacheConfig: CacheConfig = {};
let tableCacheMap: Record<string, string> = {};

export function configureCaching(config: CacheConfig, enabled: boolean): void {
  cacheConfig = config;
  cacheEnabled = enabled;

  // Build reverse map: tableName → cacheKey
  tableCacheMap = {};
  for (const [configKey, entry] of Object.entries(config)) {
    // Use the config key (lowercased) as table name mapping
    tableCacheMap[configKey.toLowerCase()] = entry.key;
  }
}

function getCacheKeyForTable(tableName: string): string | null {
  return tableCacheMap[tableName] ?? null;
}

function invalidateCacheForTable(tableName: string): void {
  if (!cacheEnabled) return;
  const key = getCacheKeyForTable(tableName);
  if (!key) return;
  try {
    CacheService.getScriptCache().remove(key);
  } catch {
    // Cache unavailable — proceed without it
  }
}

function fetchAllWithCache(tableName: string): Record<string, unknown>[] {
  const cacheKey = getCacheKeyForTable(tableName);

  if (cacheEnabled && cacheKey) {
    try {
      const cache = CacheService.getScriptCache();
      const cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const data = SheetCore.getAll(tableName);
      const duration = cacheConfig[tableName]?.duration ?? 21600;
      cache.put(cacheKey, JSON.stringify(data), duration);
      return data;
    } catch {
      return SheetCore.getAll(tableName);
    }
  }

  return SheetCore.getAll(tableName);
}

// ─── ID Generation ──────────────────────────────────────────────────────────

function generateId(tableName: string): string {
  const prefix = tableName.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${random}`;
}

// ─── Repository Factory ─────────────────────────────────────────────────────

/**
 * Create a typed repository bound to the app's schema.
 * All CRUD operations validate records against the schema automatically.
 */
export function createRepository(appSchema: AppSchema): {
  getDb: (authToken?: string) => Repository;
} {
  const repo: Repository = {
    findAll<T = Record<string, unknown>>(tableName: string): T[] {
      const records = fetchAllWithCache(tableName);
      const schema = getSchemaForTable(appSchema, tableName);

      return records.map((record) => {
        const validation = validateRecord(schema, record);
        if (!validation.isValid) {
          throw new Error(`Invalid record in '${tableName}': ${validation.msg}`);
        }
        return record as T;
      });
    },

    find<T = Record<string, unknown>>(tableName: string, fieldName: string, value: unknown): T[] {
      const rows = SheetCore.getWhere(tableName, fieldName, value);
      const schema = getSchemaForTable(appSchema, tableName);

      return rows.map((item) => {
        const validation = validateRecord(schema, item.record);
        if (!validation.isValid) {
          throw new Error(`Invalid record in '${tableName}': ${validation.msg}`);
        }
        return item.record as T;
      });
    },

    findById<T = Record<string, unknown>>(tableName: string, id: string): T[] {
      return repo.find<T>(tableName, 'id', id);
    },

    insert(tableName: string, records: Record<string, unknown>[]): number {
      const schema = getSchemaForTable(appSchema, tableName);

      const prepared = records.map((record, index) => {
        const withDefaults = applyDefaults(schema, {
          ...record,
          id: record.id || generateId(tableName),
          createdAt: record.createdAt || new Date().toISOString(),
        });

        const validation = validateRecord(schema, withDefaults);
        if (!validation.isValid) {
          throw new Error(`Validation failed for record at index ${index}: ${validation.msg}`);
        }
        return withDefaults;
      });

      const startRow = SheetCore.insertMany(tableName, prepared);
      invalidateCacheForTable(tableName);
      return startRow;
    },

    update(tableName: string, keyField: string, keyValue: unknown, updates: Record<string, unknown>): number {
      const schema = getSchemaForTable(appSchema, tableName);
      const matchingRows = SheetCore.getWhere(tableName, keyField, keyValue);
      if (matchingRows.length === 0) return 0;

      const updatesWithTimestamp = { ...updates, updatedAt: new Date().toISOString() };

      matchingRows.forEach((item) => {
        const merged = { ...item.record, ...updatesWithTimestamp };
        const validation = validateRecord(schema, merged);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.msg}`);
        }
        SheetCore.updateRow(tableName, item.rowIndex, merged);
      });

      invalidateCacheForTable(tableName);
      return matchingRows.length;
    },

    delete(tableName: string, keyField: string, keyValue: unknown): number {
      const matchingRows = SheetCore.getWhere(tableName, keyField, keyValue);
      if (matchingRows.length === 0) return 0;

      // Delete in reverse order to maintain indices
      const rowIndices = matchingRows.map((item) => item.rowIndex).sort((a, b) => b - a);
      rowIndices.forEach((rowIndex) => SheetCore.deleteRow(tableName, rowIndex));

      invalidateCacheForTable(tableName);
      return rowIndices.length;
    },

    ensureTable(tableName: string) {
      const schema = getSchemaForTable(appSchema, tableName);
      const expectedHeaders = Object.keys(schema.fields);
      SheetCore.ensureHeaders(tableName, expectedHeaders);
      return { success: true, tableName };
    },
  };

  return {
    getDb: (_authToken?: string) => repo,
  };
}
