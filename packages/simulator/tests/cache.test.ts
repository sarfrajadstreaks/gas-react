import { describe, it, expect, beforeEach } from 'vitest';
import { createCacheServiceMock } from '../src/mocks/cache';

describe('CacheService mock', () => {
  let cacheService: ReturnType<typeof createCacheServiceMock>;

  beforeEach(() => {
    cacheService = createCacheServiceMock();
  });

  it('returns separate script and user caches', () => {
    const script = cacheService.getScriptCache();
    const user = cacheService.getUserCache();
    expect(script).not.toBe(user);
  });

  it('get returns null for missing key', () => {
    expect(cacheService.getScriptCache().get('missing')).toBeNull();
  });

  it('put + get round-trips a value', () => {
    const cache = cacheService.getScriptCache();
    cache.put('key1', 'hello', 3600);
    expect(cache.get('key1')).toBe('hello');
  });

  it('remove deletes a key', () => {
    const cache = cacheService.getScriptCache();
    cache.put('key1', 'hello', 3600);
    cache.remove('key1');
    expect(cache.get('key1')).toBeNull();
  });

  it('removeAll deletes multiple keys', () => {
    const cache = cacheService.getScriptCache();
    cache.put('a', '1', 3600);
    cache.put('b', '2', 3600);
    cache.put('c', '3', 3600);
    cache.removeAll(['a', 'c']);
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBeNull();
  });

  it('expired entries return null', async () => {
    const cache = cacheService.getScriptCache();
    // Expire immediately (0 seconds → already expired by next call if we trick Date)
    cache.put('short', 'val', 0);
    // With 0 seconds, expiresAt = Date.now() + 0 → immediately expired on next check
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.get('short')).toBeNull();
  });
});
