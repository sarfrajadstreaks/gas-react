import type { Server } from 'node:http';
import type { DataSourceOptions, SpreadsheetData } from './data-source/types.js';
import { loadJsonSource, persistJsonSource } from './data-source/json-source.js';
import { createSpreadsheetAppMock } from './mocks/spreadsheet.js';
import { createCacheServiceMock } from './mocks/cache.js';
import { createPropertiesServiceMock } from './mocks/properties.js';
import {
  createLoggerMock,
  createSessionMock,
  createUtilitiesMock,
  createMailAppMock,
  createHtmlServiceMock,
} from './mocks/utilities.js';
import { createDevServer, type DevServerOptions } from './dev-server.js';

export interface SimulatorOptions extends DataSourceOptions {
  /** Email for Session.getActiveUser().getEmail() (default: "dev@localhost") */
  userEmail?: string;
  /** Timezone for Session.getScriptTimeZone() (default: "UTC") */
  timeZone?: string;
  /** Disable auto-persist on every mutation (default: false — writes auto-flush to JSON) */
  disableAutoPersist?: boolean;
}

export interface Simulator {
  /** The in-memory spreadsheet data (mutable) */
  sheets: SpreadsheetData;

  /** Install all GAS global mocks onto globalThis */
  installGlobals(): void;

  /** Remove all GAS global mocks from globalThis */
  removeGlobals(): void;

  /** Manually persist current in-memory data back to JSON files */
  persist(): void;

  /** Start the dev server for frontend executeFn calls */
  startDevServer(options: Omit<DevServerOptions, never>): Server;

  /** Direct references to mocks (for assertions / inspection) */
  mocks: {
    SpreadsheetApp: ReturnType<typeof createSpreadsheetAppMock>;
    CacheService: ReturnType<typeof createCacheServiceMock>;
    PropertiesService: ReturnType<typeof createPropertiesServiceMock>;
    Logger: ReturnType<typeof createLoggerMock>;
    Session: ReturnType<typeof createSessionMock>;
    Utilities: ReturnType<typeof createUtilitiesMock>;
    MailApp: ReturnType<typeof createMailAppMock>;
    HtmlService: ReturnType<typeof createHtmlServiceMock>;
  };
}

const GAS_GLOBALS = [
  'SpreadsheetApp',
  'CacheService',
  'PropertiesService',
  'Logger',
  'Session',
  'Utilities',
  'MailApp',
  'HtmlService',
] as const;

export function createSimulator(options: SimulatorOptions): Simulator {
  // --- Load data from JSON files ---
  const sheets: SpreadsheetData = loadJsonSource(options.dataDir);

  // --- Auto-persist callback: flush to JSON on every mutation ---
  const onMutate = options.disableAutoPersist
    ? undefined
    : () => persistJsonSource(options.dataDir, sheets);

  // --- Create mocks ---
  const mocks = {
    SpreadsheetApp: createSpreadsheetAppMock(sheets, onMutate),
    CacheService: createCacheServiceMock(),
    PropertiesService: createPropertiesServiceMock(),
    Logger: createLoggerMock(),
    Session: createSessionMock(options.userEmail, options.timeZone),
    Utilities: createUtilitiesMock(),
    MailApp: createMailAppMock(),
    HtmlService: createHtmlServiceMock(),
  };

  // --- Track originals for cleanup ---
  const originals = new Map<string, unknown>();

  function installGlobals(): void {
    const g = globalThis as Record<string, unknown>;
    for (const name of GAS_GLOBALS) {
      if (name in g) {
        originals.set(name, g[name]);
      }
      g[name] = mocks[name];
    }
  }

  function removeGlobals(): void {
    const g = globalThis as Record<string, unknown>;
    for (const name of GAS_GLOBALS) {
      if (originals.has(name)) {
        g[name] = originals.get(name);
      } else {
        delete g[name];
      }
    }
    originals.clear();
  }

  function persist(): void {
    persistJsonSource(options.dataDir, sheets);
  }

  function startDevServer(devOpts: Omit<DevServerOptions, never>): Server {
    return createDevServer(devOpts);
  }

  return {
    sheets,
    installGlobals,
    removeGlobals,
    persist,
    startDevServer,
    mocks,
  };
}

// Re-export everything
export { createDevServer } from './dev-server.js';
export type { DevServerOptions } from './dev-server.js';
export type { SheetData, SpreadsheetData, DataSourceOptions } from './data-source/types.js';
export { loadJsonSource, persistJsonSource } from './data-source/json-source.js';
export {
  createSpreadsheetAppMock,
  createCacheServiceMock,
  createPropertiesServiceMock,
  createLoggerMock,
  createSessionMock,
  createUtilitiesMock,
  createMailAppMock,
  createHtmlServiceMock,
} from './mocks/index.js';
