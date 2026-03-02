# webpack-plugin-gas-react

**Webpack plugin that deploys React apps to Google Apps Script with automatic code splitting.**

> The webpack equivalent of [`vite-plugin-gas-react`](https://www.npmjs.com/package/vite-plugin-gas-react). Write a standard React + webpack app. Build. Push to GAS.

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

## License

MIT
