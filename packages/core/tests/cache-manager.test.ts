import { describe, it, expect, beforeEach } from 'vitest';
import {
  initCache,
  isCacheEnabled,
  getFromCache,
  putInCache,
  removeFromCache,
  clearAllCache,
  withCache,
} from '../src/server/cache/cache-manager';

// ── Mock CacheService ────────────────────────────────────────────────
const store: Record<string, string> = {};

const mockCache = {
  get: (key: string) => store[key] ?? null,
  put: (key: string, value: string, _ttl: number) => {
    store[key] = value;
  },
  remove: (key: string) => {
    delete store[key];
  },
  removeAll: (keys: string[]) => {
    keys.forEach((k) => delete store[k]);
  },
};

(globalThis as Record<string, unknown>).CacheService = {
  getScriptCache: () => mockCache,
  getUserCache: () => mockCache,
};

// ── Helpers ──────────────────────────────────────────────────────────
function clearStore() {
  for (const key of Object.keys(store)) delete store[key];
}

// ── Tests ────────────────────────────────────────────────────────────
describe('initCache / isCacheEnabled', () => {
  it('starts disabled', () => {
    initCache({}, false);
    expect(isCacheEnabled()).toBe(false);
  });

  it('can be enabled', () => {
    initCache({}, true);
    expect(isCacheEnabled()).toBe(true);
  });
});

describe('getFromCache / putInCache', () => {
  beforeEach(() => {
    clearStore();
  });

  it('returns null when disabled', () => {
    initCache({}, false);
    expect(getFromCache('key')).toBeNull();
  });

  it('returns null on cache miss', () => {
    initCache({}, true);
    expect(getFromCache('missing')).toBeNull();
  });

  it('round-trips data through put then get', () => {
    initCache({}, true);
    putInCache('users', [{ id: 1, name: 'Alice' }], 300);
    expect(getFromCache('users')).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('putInCache is a no-op when disabled', () => {
    initCache({}, false);
    putInCache('users', [1, 2, 3], 300);
    // Enable and check — nothing should be stored
    initCache({}, true);
    expect(getFromCache('users')).toBeNull();
  });

  it('supports suffix for key namespacing', () => {
    initCache({}, true);
    putInCache('data', 'global', 300);
    putInCache('data', 'user-specific', 300, ':user1');
    expect(getFromCache('data')).toBe('global');
    expect(getFromCache('data', ':user1')).toBe('user-specific');
  });

  it('uses config duration as fallback', () => {
    initCache({ myKey: { key: 'myKey', duration: 600 } }, true);
    // putInCache without explicit duration — should still work (not throw)
    putInCache('myKey', { cached: true });
    expect(getFromCache('myKey')).toEqual({ cached: true });
  });
});

describe('removeFromCache', () => {
  beforeEach(() => {
    clearStore();
    initCache({}, true);
  });

  it('removes a cached entry', () => {
    putInCache('key', 'value', 300);
    expect(getFromCache('key')).toBe('value');
    removeFromCache('key');
    expect(getFromCache('key')).toBeNull();
  });

  it('handles removing non-existent key gracefully', () => {
    expect(() => removeFromCache('nope')).not.toThrow();
  });
});

describe('clearAllCache', () => {
  beforeEach(() => {
    clearStore();
  });

  it('clears all keys registered in config', () => {
    initCache(
      {
        a: { key: 'a', duration: 300 },
        b: { key: 'b', duration: 300 },
      },
      true,
    );
    putInCache('a', 'dataA', 300);
    putInCache('b', 'dataB', 300);

    const result = clearAllCache();
    expect(result.success).toBe(true);
    expect(getFromCache('a')).toBeNull();
    expect(getFromCache('b')).toBeNull();
  });
});

describe('withCache', () => {
  beforeEach(() => {
    clearStore();
    initCache({}, true);
  });

  it('calls fetchFunction on cache miss and caches result', () => {
    let callCount = 0;
    const fetcher = () => {
      callCount++;
      return [{ id: 1 }];
    };

    const first = withCache({ cacheKey: 'items', fetchFunction: fetcher, duration: 300 });
    expect(first).toEqual([{ id: 1 }]);
    expect(callCount).toBe(1);

    // Second call should come from cache
    const second = withCache({ cacheKey: 'items', fetchFunction: fetcher, duration: 300 });
    expect(second).toEqual([{ id: 1 }]);
    expect(callCount).toBe(1); // not called again
  });

  it('always calls fetchFunction when cache is disabled', () => {
    initCache({}, false);
    let callCount = 0;
    const fetcher = () => {
      callCount++;
      return 'fresh';
    };

    withCache({ cacheKey: 'x', fetchFunction: fetcher });
    withCache({ cacheKey: 'x', fetchFunction: fetcher });
    expect(callCount).toBe(2);
  });

  it('re-fetches after cache invalidation', () => {
    let version = 1;
    const fetcher = () => ({ v: version++ });

    const first = withCache({ cacheKey: 'ver', fetchFunction: fetcher, duration: 300 });
    expect(first).toEqual({ v: 1 });

    removeFromCache('ver');

    const second = withCache({ cacheKey: 'ver', fetchFunction: fetcher, duration: 300 });
    expect(second).toEqual({ v: 2 });
  });
});
