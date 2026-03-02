# gas-vite-plugin

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
npm install gas-vite-plugin
npm install -D vite @vitejs/plugin-react
```

### 2. Configure Vite

```ts
// vite.config.ts
import { createGASViteConfig } from 'gas-vite-plugin';

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
import { gasPlugin } from 'gas-vite-plugin';
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
