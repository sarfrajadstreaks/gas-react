# lite-gas-simulator

Lightweight local simulator for Google Apps Script. Develop and test your GAS server code without `clasp push`.

## What it does

Mocks all GAS globals (`SpreadsheetApp`, `CacheService`, `PropertiesService`, `Logger`, `Session`, `Utilities`, `MailApp`, `HtmlService`) against local data sources so your server functions run unmodified on your machine.

## Install

```bash
npm install lite-gas-simulator --save-dev
```

## Quick Start

### 1. Create mock data

Create a directory with one JSON file per sheet. Each file is a 2D array where the first row is headers:

```
mock-data/
├── users.json
└── products.json
```

```json
// mock-data/users.json
[
  ["id", "name", "email"],
  ["1", "Alice", "alice@test.com"],
  ["2", "Bob", "bob@test.com"]
]
```

### 2. Create and use the simulator

```ts
import { createSimulator } from 'lite-gas-simulator';
import { DataStore } from 'gas-react-core/server';

const sim = createSimulator({
  dataDir: './mock-data',
});

// Injects SpreadsheetApp, CacheService, etc. into globalThis
sim.installGlobals();

// Now your server code works locally!
const users = DataStore.getAll('users');
console.log(users);
// [{ id: '1', name: 'Alice', email: 'alice@test.com' }, ...]
```

### 3. Start a dev server (optional)

If your frontend uses `executeFn` with `__GAS_DEV_MODE__`, start the companion HTTP server:

```ts
sim.startDevServer({
  port: 3001,
  functions: {
    getUsers: () => DataStore.getAll('users'),
    addUser: (user) => DataStore.insert('users', user),
  },
});
```

Your React app's `executeFn('getUsers')` calls will hit `localhost:3001/api/getUsers` and execute against mock data.

## Data Sources

### JSON directory (recommended)

```ts
const sim = createSimulator({
  dataDir: './mock-data', // directory of .json files
});
```

Each `.json` file = one sheet. Filename (without extension) = sheet name.

## API

### `createSimulator(options?)`

| Option               | Type     | Description                                |
| -------------------- | -------- | ------------------------------------------ |
| `dataDir` (required) | `string` | Path to directory of JSON files            |
| `userEmail`          | `string` | Email for `Session.getActiveUser()` mock   |
| `timeZone`           | `string` | Timezone for `Session.getScriptTimeZone()` |
| `disableAutoPersist` | `boolean`| Set `true` to skip auto-flushing to disk   |

Returns a `Simulator` object:

| Method             | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `installGlobals()` | Set all GAS mocks on `globalThis`                    |
| `removeGlobals()`  | Clean up `globalThis`                                |
| `persist()`        | Manually flush in-memory data to JSON (auto by default) |
| `startDevServer()` | Start HTTP dev server for frontend `executeFn` calls |
| `sheets`           | The raw `Map<string, unknown[][]>` data              |
| `mocks`            | Direct access to all mock objects                    |

### `createDevServer(options)`

| Option      | Type                                                  | Default | Description              |
| ----------- | ----------------------------------------------------- | ------- | ------------------------ |
| `port`      | `number`                                              | `3001`  | Port to listen on        |
| `functions` | `Record<string, (...args: unknown[]) => unknown>`     | —       | Server function registry |
| `cors`      | `boolean`                                             | `true`  | Enable CORS headers      |
| `verbose`   | `boolean`                                             | `true`  | Log requests to console  |

### Individual mock factories

All mocks can be used standalone for unit testing:

```ts
import {
  createSpreadsheetAppMock,
  createCacheServiceMock,
  createPropertiesServiceMock,
  createLoggerMock,
  createSessionMock,
  createUtilitiesMock,
  createMailAppMock,
  createHtmlServiceMock,
} from 'lite-gas-simulator';
```

## Persistence

By default, **every mutation auto-persists** to the JSON files on disk. When your code calls `appendRow`, `setValues`, `deleteRow`, or `insertSheet`, the changes are immediately written back to the corresponding `.json` file in `dataDir`.

This means data survives process restarts — no manual save step needed.

To disable auto-persist (e.g. for performance in bulk operations):

```ts
const sim = createSimulator({
  dataDir: './mock-data',
  disableAutoPersist: true,
});

// ... do bulk mutations ...
sim.persist(); // flush manually when ready
```

## Use in Tests

```ts
import { describe, it, beforeEach, afterEach } from 'vitest';
import { createSimulator } from 'gas-simulator';
import { DataStore } from 'gas-react-core/server';

describe('my server functions', () => {
  let sim;

  beforeEach(() => {
    // Point to a test-data directory with JSON files
    sim = createSimulator({
      dataDir: './test-data',
    });
    sim.installGlobals();
  });

  afterEach(() => {
    sim.removeGlobals();
  });

  it('getAll returns users', () => {
    const users = DataStore.getAll('users');
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Alice');
  });
});
```

## License

MIT
