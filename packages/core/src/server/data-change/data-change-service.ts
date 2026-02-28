/**
 * Data Change Tracking
 *
 * Tracks timestamps of last data mutations per data type.
 * The client polls these to know when to refresh stale pages.
 */

export interface DataChangeTracker {
  getTimestamps(token: string): Record<string, string>;
  markChanged(dataTypes: string | string[]): void;
  initialize(): void;
}

export function createDataChangeService(
  changeKeys: Record<string, string>,
  requireAuth: (token: string) => unknown
): DataChangeTracker {
  return {
    getTimestamps(token: string): Record<string, string> {
      requireAuth(token);
      const cache = CacheService.getScriptCache();
      const timestamps: Record<string, string> = {};

      for (const [key, cacheKey] of Object.entries(changeKeys)) {
        timestamps[key.toLowerCase()] = cache.get(cacheKey) || '0';
      }

      return timestamps;
    },

    markChanged(dataTypes: string | string[]): void {
      try {
        const cache = CacheService.getScriptCache();
        const now = Date.now().toString();
        const types = Array.isArray(dataTypes) ? dataTypes : [dataTypes];

        for (const type of types) {
          const cacheKey = changeKeys[type];
          if (cacheKey) {
            cache.put(cacheKey, now, 21600);
          }
        }
      } catch {
        // Non-fatal
      }
    },

    initialize(): void {
      const cache = CacheService.getScriptCache();
      const now = Date.now().toString();

      for (const cacheKey of Object.values(changeKeys)) {
        if (!cache.get(cacheKey)) {
          cache.put(cacheKey, now, 21600);
        }
      }
    },
  };
}
