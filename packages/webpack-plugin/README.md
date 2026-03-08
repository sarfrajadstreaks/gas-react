# webpack-plugin-gas-react

**Webpack plugin that deploys React apps to Google Apps Script with automatic code splitting.**

---

## What's New in v0.2.0 🎉

**Separate Chunk Files** - Chunks are now emitted as individual files in a `chunks/` directory instead of being bundled into a single `__gas_chunks__.js` file.

✅ **Benefits:**
- Better organization - each lazy-loaded component gets its own file
- Cleaner Apps Script project structure
- Easier debugging - inspect individual chunk files
- Consistent with vite-plugin approach

**Before (v0.1.x):**
```
dist/
├── Code.js
├── __gas_entry__.js
├── __gas_chunks__.js (1MB - all chunks bundled)
└── index.html
```

**After (v0.2.0):**
```
dist/
├── Code.js
├── __gas_entry__.js
├── index.html
└── chunks/
    ├── __gas_chunk_164__.js
    ├── __gas_chunk_276__.js
    ├── __gas_chunk_489__.js
    └── ... (one file per lazy-loaded component)
```

Chunks still load on-demand via `google.script.run.getPage()` - only the file organization has changed!

---

## Install

```bash
npm install webpack-plugin-gas-react --save-dev
```

**Peer dependencies** (install if missing):

```bash
npm install webpack html-webpack-plugin --save-dev
```

---

## Quick Start

### Option 1: `createGASWebpackConfig` (recommended)

Generates a complete webpack config — just like `createGASViteConfig` does for Vite:

```js
// webpack.config.mjs
import { createGASWebpackConfig } from 'webpack-plugin-gas-react';

export default await createGASWebpackConfig({
  clientRoot: 'src/client',
  appTitle: 'My App',
  serverEntry: 'src/server/index.ts',
});
```

### Option 2: Use `GASWebpackPlugin` directly

Add the plugin to your existing webpack config:

```js
// webpack.config.mjs
import { GASWebpackPlugin } from 'webpack-plugin-gas-react';
import HtmlWebpackPlugin from 'html-webpack-plugin';

export default {
  entry: './src/client/index.tsx',
  output: { path: './dist', clean: true },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/client/index.html' }),
    new GASWebpackPlugin({
      appTitle: 'My App',
      serverEntry: 'src/server/index.ts',
    }),
  ],
  // ... rest of config
};
```

### Build & Deploy

```bash
npx webpack
cd dist && clasp push
```

---

## How It Works

```
React App (Webpack)
  ├── Client code → webpack build → code-split chunks stored as GAS string variables
  └── Server code → esbuild → global functions in Code.js
```

1. **Entry code** is stored as a string variable (`__GAS_ENTRY_CODE__`) and loaded at runtime via `getEntryCode()`
2. **Lazy chunks** (`React.lazy()`) are stored as `__GAS_CHUNK_page_*__` string variables, loaded on demand via `getPage(name)`
3. **Server entry** is bundled via esbuild with exports hoisted to global scope
4. **HTML** is transformed — webpack script tags are removed and replaced with a GAS chunk loader
5. **`Code.js`** is generated with `doGet()`, `getPage()`, `getEntryCode()`, and your server functions
6. **`appsscript.json`** is generated automatically

---

## Options

### `createGASWebpackConfig(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `clientRoot` | `string` | `"src/client"` | Root directory of client code |
| `outDir` | `string` | `"dist"` | Output directory |
| `devServerPort` | `number` | `3001` | Port for the gas-react-core dev server proxy |
| `devPort` | `number` | `8080` | Webpack dev server port |
| `aliases` | `Record<string, string>` | `{}` | Path aliases (e.g. `{ "@": "src" }`) |
| `plugins` | `unknown[]` | `[]` | Extra webpack plugins |
| `appTitle` | `string` | `"GAS App"` | Title for the GAS web app |
| `serverEntry` | `string` | — | Path to server entry (e.g. `"src/server/index.ts"`) |
| `webpack` | `object` | `{}` | Additional webpack config overrides |

### `GASWebpackPlugin(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `pagePrefix` | `string` | `"page_"` | Prefix for lazy-loaded page chunk names |
| `appTitle` | `string` | `"GAS App"` | Title for the web app |
| `serverEntry` | `string` | — | Path to server entry file |

---

## Development Mode

Set `GAS_LOCAL=true` to run in dev mode:

```bash
GAS_LOCAL=true npx webpack serve
```

When `createGASWebpackConfig` detects dev mode:
- Runs a normal webpack dev server (HMR, source maps)
- Sets `window.__GAS_DEV_MODE__ = true` so `gas-react-core/client` routes calls to your local dev server
- Does **not** apply GAS transformations

---

## Comparison with vite-plugin-gas-react

Both plugins produce identical GAS output. Choose based on your bundler:

| Feature | vite-plugin-gas-react | webpack-plugin-gas-react |
|---|---|---|
| Bundler | Vite | Webpack 5+ |
| Code splitting | ✅ | ✅ |
| Server bundling | ✅ (esbuild) | ✅ (esbuild) |
| HTML transform | ✅ | ✅ |
| Dev mode | ✅ | ✅ |
| `appsscript.json` | ✅ | ✅ |
| Config helper | `createGASViteConfig` | `createGASWebpackConfig` |

---

## Full Example

**webpack.config.mjs**:

```js
import { createGASWebpackConfig } from 'webpack-plugin-gas-react';

export default await createGASWebpackConfig({
  clientRoot: 'src/client',
  appTitle: 'My App',
  serverEntry: 'src/server/index.ts',
});
```

**Server** (`src/server/index.ts`):

```ts
import { DataStore, withCache, removeFromCache } from 'gas-react-core/server';

export function getUsers() {
  return withCache({
    cacheKey: 'all-users',
    fetchFunction: () => DataStore.getAll('users'),
  });
}

export function createUser(data: Record<string, unknown>) {
  DataStore.insert('users', data);
  removeFromCache('all-users');
  return { success: true };
}
```

**Client** (`src/services/user-service.ts`):

```ts
import { executeFn } from 'gas-react-core/client';

export const getUsers = () => executeFn<User[]>('getUsers');
export const createUser = (data: User) => executeFn('createUser', [data]);
```

**Build & deploy**:

```bash
npx webpack
cd dist && clasp push
```

---

## Combine with [`gas-react-core`](https://www.npmjs.com/package/gas-react-core)

This plugin handles **build & deployment**. Pair it with [`gas-react-core`](https://www.npmjs.com/package/gas-react-core) to unlock a complete client-server toolkit:

```bash
npm install gas-react-core
```

### What `gas-react-core` adds

| Feature | Import | What it does |
|---|---|---|
| **`executeFn`** | `gas-react-core/client` | Typed Promise wrapper around `google.script.run` — call server functions from React without callbacks |
| **`DataStore`** | `gas-react-core/server` | Generic CRUD for Google Sheets (getAll, findBy, insert, update, remove) — each sheet is a table |
| **Cache utilities** | `gas-react-core/server` | `withCache`, `getFromCache`, `putInCache`, `removeFromCache` — opt-in caching on top of GAS `CacheService` |
| **`initApp`** | `gas-react-core/server` | One-liner `doGet()` setup with title and meta tags |
| **Library mode** | `gas-react-core/client` | Publish your project as a GAS Library — `executeFn` routes calls through a proxy function automatically |

### Example: full-stack GAS app

**Server** (`src/server/index.ts`):

```ts
import { DataStore, initCache, withCache, removeFromCache, initApp } from 'gas-react-core/server';

initCache({
  'all-users': { key: 'all-users', duration: 300 },
}, true);

const app = initApp({ title: 'My App' });
export function doGet(e: unknown) { return app.doGet(e); }

export function getUsers() {
  return withCache({
    cacheKey: 'all-users',
    fetchFunction: () => DataStore.getAll('users'),
  });
}

export function createUser(data: Record<string, unknown>) {
  DataStore.insert('users', data);
  removeFromCache('all-users');
  return { success: true };
}
```

**Client service** (`src/services/user-service.ts`):

```ts
import { executeFn } from 'gas-react-core/client';

export const getUsers = () => executeFn<User[]>('getUsers');
export const createUser = (data: User) => executeFn('createUser', [data]);
```

> **TL;DR** — `webpack-plugin-gas-react` builds & deploys your React app to GAS. `gas-react-core` gives you the server utilities (Sheets CRUD, caching, app init) and a typed client bridge (`executeFn`) to tie it all together.

---

## Local Testing with [`lite-gas-simulator`](https://www.npmjs.com/package/lite-gas-simulator)

Develop and test your GAS server code **locally** — no `clasp push` required. [`lite-gas-simulator`](https://www.npmjs.com/package/lite-gas-simulator) mocks all GAS globals (`SpreadsheetApp`, `CacheService`, `PropertiesService`, `Logger`, etc.) against local JSON files so your server functions run unmodified on your machine.

```bash
npm install lite-gas-simulator --save-dev
```

### How it fits in

1. **Mock data** — create a directory with one JSON file per sheet (row 1 = headers):

    ```
    mock-data/
    ├── users.json      # [["id","name","email"],["1","Alice","alice@test.com"]]
    └── products.json
    ```

2. **Run server code locally** — works seamlessly with `gas-react-core`:

    ```ts
    import { createSimulator } from 'lite-gas-simulator';
    import { DataStore } from 'gas-react-core/server';

    const sim = createSimulator({ dataDir: './mock-data' });
    sim.installGlobals();

    // Your server functions work locally now
    const users = DataStore.getAll('users');
    ```

3. **Companion dev server** — when your webpack app runs with `GAS_LOCAL=true`, `executeFn` sends requests to `localhost:3001`. Start the simulator's dev server to handle them:

    ```ts
    sim.startDevServer({
      port: 3001,
      functions: {
        getUsers: () => DataStore.getAll('users'),
        createUser: (data) => DataStore.insert('users', data),
      },
    });
    ```

4. **Use in tests** — install/remove globals in `beforeEach`/`afterEach` for isolated unit tests:

    ```ts
    import { createSimulator } from 'lite-gas-simulator';
    import { DataStore } from 'gas-react-core/server';

    let sim;
    beforeEach(() => {
      sim = createSimulator({ dataDir: './test-data' });
      sim.installGlobals();
    });
    afterEach(() => sim.removeGlobals());

    it('returns users', () => {
      expect(DataStore.getAll('users')).toHaveLength(2);
    });
    ```

> **TL;DR** — `lite-gas-simulator` lets you run and test your `gas-react-core` server code entirely offline. Mutations auto-persist to your JSON files, and the built-in dev server bridges your webpack frontend during local development.

## License

MIT
