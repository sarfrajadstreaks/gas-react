# gas-react

**Build and deploy React apps to Google Apps Script — with code splitting, server-side functions, and zero boilerplate.**

> Write a standard React + Vite app. Run one command. Get a working GAS web app.

---

## Packages

| Package | Description |
|---|---|
| [`@sarfrajadstreaks/gas-vite-plugin`](./packages/vite-plugin) | Vite plugin — transforms React builds for GAS deployment with code splitting |
| [`@sarfrajadstreaks/gas-core`](./packages/core) | Client-server bridge (`executeFn`) and server utilities (`DataStore`, `Cache`) |

## How It Works

```
React App (Vite)
  ├── Client code → Vite build → code-split chunks stored as GAS string variables
  └── Server code → esbuild → global functions in Code.js
```

1. You write a normal React app with `React.lazy()` for page-level code splitting
2. The **vite plugin** transforms the build output into GAS-compatible files
3. Server-side TypeScript is bundled into `Code.js` as global functions
4. The **core** package provides `executeFn()` to call those server functions from React, and `DataStore` to read/write Google Sheets

## Quick Start

```bash
npm install @sarfrajadstreaks/gas-vite-plugin @sarfrajadstreaks/gas-core
```

### vite.config.ts

```ts
import { createGASViteConfig } from '@sarfrajadstreaks/gas-vite-plugin';

export default createGASViteConfig({
  clientRoot: 'src',
  appTitle: 'My App',
  serverEntry: 'src/server/index.ts',
});
```

### Server (`src/server/index.ts`)

```ts
import { DataStore } from '@sarfrajadstreaks/gas-core/server';

export function getItems() {
  return DataStore.getAll('items');
}
```

### Service (`src/services/item-service.ts`)

```ts
import { executeFn } from '@sarfrajadstreaks/gas-core/client';

export const getItems = () => executeFn<Item[]>('getItems');
```

### Component (`src/pages/Items.tsx`)

```tsx
import { getItems } from '../services/item-service';

export default function Items() {
  const [items, setItems] = useState([]);
  useEffect(() => { getItems().then(setItems); }, []);
  return <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
}
```

### Build & Deploy

```bash
npx vite build
cd dist && clasp push
```

## Development

```bash
git clone https://github.com/sarfrajadstreaks/gas-react.git
cd gas-react
npm install
npm run build
```

## Repository Structure

```
packages/
  vite-plugin/   → @sarfrajadstreaks/gas-vite-plugin
  core/          → @sarfrajadstreaks/gas-core
```

## License

MIT
