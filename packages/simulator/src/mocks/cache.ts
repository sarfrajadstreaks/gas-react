/**
 * Mock implementation of Google Apps Script's CacheService.
 * Uses an in-memory Map with TTL support.
 */

interface CacheEntry {
  value: string;
  expiresAt: number;
}

function createCacheMock() {
  const store = new Map<string, CacheEntry>();

  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  }

  return {
    get(key: string): string | null {
      cleanup();
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },

    put(key: string, value: string, expirationInSeconds: number): void {
      store.set(key, {
        value,
        expiresAt: Date.now() + expirationInSeconds * 1000,
      });
    },

    remove(key: string): void {
      store.delete(key);
    },

    removeAll(keys: string[]): void {
      for (const key of keys) {
        store.delete(key);
      }
    },
  };
}

export function createCacheServiceMock() {
  const scriptCache = createCacheMock();
  const userCache = createCacheMock();

  return {
    getScriptCache() {
      return scriptCache;
    },
    getUserCache() {
      return userCache;
    },
  };
}
