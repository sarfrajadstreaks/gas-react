interface CacheEntry {
  key: string;
  duration: number;
}

type CacheConfig = Record<string, CacheEntry>;

let _cacheConfig: CacheConfig = {};
let _enabled = false;

export function initCache(config: CacheConfig, enabled: boolean): void {
  _cacheConfig = config;
  _enabled = enabled;
}

export function isCacheEnabled(): boolean {
  return _enabled;
}

export function getFromCache<T = unknown>(cacheKey: string, suffix = ''): T | null {
  if (!_enabled) return null;
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get(cacheKey + suffix);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function putInCache(cacheKey: string, data: unknown, duration?: number, suffix = ''): void {
  if (!_enabled) return;
  try {
    const cache = CacheService.getScriptCache();
    const ttl = duration ?? _cacheConfig[cacheKey]?.duration ?? 21600;
    cache.put(cacheKey + suffix, JSON.stringify(data), ttl);
  } catch {
    // Cache write failed — non-fatal
  }
}

export function removeFromCache(cacheKey: string, suffix = ''): void {
  try {
    CacheService.getScriptCache().remove(cacheKey + suffix);
  } catch {
    // non-fatal
  }
}

export function clearAllCache(): { success: boolean; message: string } {
  try {
    const allKeys = Object.values(_cacheConfig).map((c) => c.key);
    CacheService.getScriptCache().removeAll(allKeys);
    CacheService.getUserCache().removeAll(allKeys);
    return { success: true, message: 'All caches cleared' };
  } catch (e) {
    return { success: false, message: `Error clearing cache: ${e}` };
  }
}

export function withCache<T>(opts: {
  cacheKey: string;
  fetchFunction: () => T;
  duration?: number;
  suffix?: string;
}): T {
  const cached = getFromCache<T>(opts.cacheKey, opts.suffix);
  if (cached !== null) return cached;

  const data = opts.fetchFunction();
  putInCache(opts.cacheKey, data, opts.duration, opts.suffix);
  return data;
}
