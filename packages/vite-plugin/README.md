# vite-plugin-gas-react

**Deploy React apps to Google Apps Script — with code splitting.**

> Write a standard React + Vite app. Run one command. Get a working GAS web app with lazy-loaded pages.

---

## Why?

Google Apps Script only serves HTML files via `HtmlService`. External `<script>` tags are blocked by the CAJA sanitizer. That means:

- No ES modules, no `import()`, no `<script src="...">`
- You normally have to inline **everything** into a single HTML file
- Code splitting? Lazy loading? Forget it.

This plugin solves all of that. You write a normal React app with `React.lazy()` and Vite's natural code splitting — the plugin transforms the build output into something GAS can actually serve.

## How It Works

```
React App (Vite) → Build → GAS-compatible output → clasp push → Live web app
```

The plugin runs at build time and:

1. **Stores all JS server-side** as `.gs` string variables (completely bypasses CAJA)
2. **Rewrites `import()`** calls to fetch chunks via `google.script.run.getPage()`
3. **Builds a dependency graph** so shared chunks load before the pages that need them
4. **Generates `Code.js`** with `doGet()`, `getEntryCode()`, and `getPage()` functions
5. **Generates `appsscript.json`** with the correct webapp configuration

At runtime, the entry JS is loaded via `google.script.run.getEntryCode()` and injected into a `<script>` tag. When you navigate to a lazy page, the chunk loader fetches its code (and any shared dependencies) the same way.

### Build Output

```
dist/
├── index.html           ← Served by doGet() — contains the chunk loader
├── __gas_entry__.js     ← Entry bundle stored as a .gs string variable
├── __gas_chunks__.js    ← All lazy + shared chunks as .gs string variables
├── Code.js              ← Server functions: doGet(), getEntryCode(), getPage()
└── appsscript.json      ← GAS project manifest
```

## Quick Start

### 1. Install

```bash
npm install vite-plugin-gas-react
npm install -D vite @vitejs/plugin-react
```

### 2. Configure Vite

```ts
// vite.config.ts
import { createGASViteConfig } from 'vite-plugin-gas-react';

export default createGASViteConfig({
  clientRoot: 'src',
  appTitle: 'My App',
});
```

That's it. `createGASViteConfig()` sets up React, the GAS plugin, aliases, and dev mode automatically.

### 3. Write Your App

Use `React.lazy()` for page-level code splitting — Vite will split them into separate chunks, and the plugin will handle the rest:

```tsx
// src/App.tsx
import { useState, Suspense, lazy } from 'react';

const Home = lazy(() => import('./pages/Home'));
const Settings = lazy(() => import('./pages/Settings'));

const pages = { Home, Settings };

export default function App() {
  const [page, setPage] = useState('Home');
  const Page = pages[page];

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Page />
    </Suspense>
  );
}
```

```tsx
// src/pages/Home.tsx
export default function Home() {
  return <h1>Home Page</h1>;
}
```

### 4. Set Up Clasp

```bash
npm install -g @google/clasp
clasp login
clasp create --type webapp --rootDir dist
```

### 5. Build & Deploy

```bash
npx vite build
cd dist && clasp push
```

Open the GAS web app URL and your React app is live.

## Configuration

### `createGASViteConfig(options?)`

Returns a complete Vite config. All options are optional:

| Option | Default | Description |
|---|---|---|
| `clientRoot` | `'src/client'` | Path to client source directory |
| `outDir` | `'dist'` | Build output directory |
| `appTitle` | `'GAS App'` | Title shown in the browser tab |
| `devServerPort` | `3001` | Port for local dev API server |
| `devPort` | `5173` | Vite dev server port |
| `aliases` | `{}` | Additional path aliases (`@` → `src/` is automatic) |
| `plugins` | `[]` | Additional Vite plugins |
| `vite` | `{}` | Override/extend any Vite config option |

### `gasPlugin(options?)`

Use this if you're building your own Vite config instead of using `createGASViteConfig()`:

```ts
import { gasPlugin } from 'vite-plugin-gas-react';
import react from '@vitejs/plugin-react';

export default {
  plugins: [react(), gasPlugin({ appTitle: 'My App' })],
};
```

| Option | Default | Description |
|---|---|---|
| `pagePrefix` | `'page_'` | Prefix for page chunk names |
| `appTitle` | `'GAS App'` | Web app title |

### `isLocalDev()`

Returns `true` when `GAS_LOCAL=true` is set in environment. Use to branch behavior between local development and GAS deployment:

```ts
if (isLocalDev()) {
  // Local dev: use mock data or local API
} else {
  // Production: use google.script.run
}
```

## How Code Splitting Works

Vite naturally splits your app into chunks:

- **Entry chunk** — React, your app shell, shared dependencies
- **Page chunks** — One per `React.lazy(() => import('./pages/X'))` call
- **Shared lib chunks** — Common dependencies used by multiple pages (e.g., MUI components)

The plugin transforms these into GAS-compatible form:

| Vite Output | Plugin Transform | GAS Runtime |
|---|---|---|
| `assets/index-abc.js` (entry) | `__GAS_ENTRY_CODE__` string variable | Loaded via `getEntryCode()` |
| `assets/Home-xyz.js` (page) | `__GAS_CHUNK_page_Home__` string variable | Loaded via `getPage('page_Home')` |
| `assets/Stack-def.js` (shared lib) | `__GAS_CHUNK_lib_Stack__` string variable | Auto-loaded as dependency |

Each chunk type gets its own **isolated namespace** to prevent variable collisions:

- Entry exports → `window.__gasEntry__`
- Shared lib exports → `window.__gasLib_<name>__`
- Page exports → `window.__gasChunkExports` (per-chunk, cleaned up after load)

The plugin automatically builds a dependency graph. When you navigate to `Home`, the loader first loads `lib_Stack` (if not cached), then loads `page_Home`. All subsequent navigations to pages sharing the same libs skip reloading them.

## Local Development

Set `GAS_LOCAL=true` to run your app with Vite's dev server instead of deploying to GAS:

```bash
GAS_LOCAL=true npx vite
```

In local mode, `createGASViteConfig()`:
- Skips the GAS plugin entirely
- Injects `window.__GAS_DEV_MODE__ = true`
- Injects `window.__GAS_DEV_SERVER__` pointing to your local API server

---

## Combine with [`gas-react-core`](https://www.npmjs.com/package/gas-react-core)

This plugin handles **build & deployment**. Pair it with [`gas-react-core`](https://www.npmjs.com/package/gas-react-core) to get a complete client-server toolkit:

```bash
npm install gas-react-core
```

### What `gas-react-core` adds

| Feature | Import | What it does |
|---|---|---|
| **`executeFn`** | `gas-react-core/client` | Typed Promise wrapper around `google.script.run` — call server functions from React without callbacks |
| **`DataStore`** | `gas-react-core/server` | Generic CRUD for Google Sheets (getAll, findBy, insert, update, remove) — each sheet is a table |
| **Cache utilities** | `gas-react-core/server` | `withCache`, `getFromCache`, `putInCache`, `removeFromCache` — opt-in caching layer on top of GAS `CacheService` |
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

> **TL;DR** — `vite-plugin-gas-react` builds & deploys your React app to GAS. `gas-react-core` gives you the server utilities (Sheets CRUD, caching, app init) and a typed client bridge (`executeFn`) to tie it all together.

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

3. **Companion dev server** — when your Vite app runs with `GAS_LOCAL=true`, `executeFn` sends requests to `localhost:3001`. Start the simulator's dev server to handle them:

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

> **TL;DR** — `lite-gas-simulator` lets you run and test your `gas-react-core` server code entirely offline. Mutations auto-persist to your JSON files, and the built-in dev server bridges your Vite frontend during local development.

- Enables Vite HMR and hot reload

You can use these globals in your app to switch between `google.script.run` calls (production) and `fetch()` calls (local dev).

## Requirements

- **Node.js** ≥ 18
- **Vite** ≥ 5
- **React** 18 or 19 (with `React.lazy()` for code splitting)
- **clasp** CLI for deployment (`npm install -g @google/clasp`)

## Limitations

- **GAS execution time limits** still apply (6 min/execution, 30 sec for web app requests)
- **Chunk loading** adds a round-trip per chunk on first navigation (chunks are cached after first load)
- **No SSR** — this is a client-side React app served via `HtmlService`
- **File size** — GAS has a 50MB total project size limit. Large apps with many dependencies should be fine, but keep an eye on it.

## License

MIT
