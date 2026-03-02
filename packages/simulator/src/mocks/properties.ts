/**
 * Mock implementation of Google Apps Script's PropertiesService.
 * Uses an in-memory Map.
 */

function createPropertiesMock() {
  const store = new Map<string, string>();

  return {
    getProperty(key: string): string | null {
      return store.get(key) ?? null;
    },

    setProperty(key: string, value: string): void {
      store.set(key, value);
    },

    deleteProperty(key: string): void {
      store.delete(key);
    },

    getProperties(): Record<string, string> {
      return Object.fromEntries(store);
    },

    setProperties(properties: Record<string, string>): void {
      for (const [k, v] of Object.entries(properties)) {
        store.set(k, v);
      }
    },
  };
}

export function createPropertiesServiceMock() {
  const scriptProperties = createPropertiesMock();

  return {
    getScriptProperties() {
      return scriptProperties;
    },
  };
}
