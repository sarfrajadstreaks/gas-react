# gas-react-core

**Client-server bridge and server utilities for Google Apps Script React apps.**

> Call GAS server functions from React with full TypeScript support. Read/write Google Sheets with zero boilerplate.

---

## Install

```bash
npm install gas-react-core
```

## Two Entry Points

| Import | Runs In | Purpose |
|---|---|---|
| `gas-react-core/client` | Browser (React) | Call server functions via `google.script.run` |
| `gas-react-core/server` | GAS runtime | Sheet CRUD, caching, app initialization |

---

## Client — `executeFn`

A typed wrapper around `google.script.run` that returns Promises.

```ts
import { executeFn } from 'gas-react-core/client';

// Call a server function by name
const users = await executeFn<User[]>('getUsers');

// Pass arguments
const user = await executeFn<User>('getUserById', ['abc123']);
```

### How it works

- **Production**: calls `google.script.run.<funcName>()` and wraps the callback in a Promise
- **Dev mode**: when `window.__GAS_DEV_MODE__` is `true`, sends a POST to your local dev server instead (`http://localhost:3001/api/<funcName>`)

### Execution Modes

```ts
import { configureExecution, executeFn } from 'gas-react-core/client';

// Direct mode (default) — calls server functions directly
configureExecution({ mode: 'direct' });

// Library mode — routes through runLibraryFunction() proxy
configureExecution({ mode: 'library' });
```

**Direct mode** (default): Your React UI and server code live in the same GAS project. `executeFn('getUsers')` calls `google.script.run.getUsers()` directly.

**Library mode**: Your project is published as a GAS [Library](https://developers.google.com/apps-script/guides/libraries). Library functions aren't available on `google.script.run`, so all calls route through a single proxy function `runLibraryFunction(funcName, args)` that the consuming script must define:

```js
// In the consumer's Code.gs (the script that imported your library as "MyLib")
function runLibraryFunction(funcName, args) {
  return MyLib[funcName].apply(null, args);
}
```

Then in your React client:
```ts
configureExecution({ mode: 'library' });
const users = await executeFn<User[]>('getUsers');
// → calls google.script.run.runLibraryFunction('getUsers', [])
```

### Service Layer Pattern

Create a typed service layer so your components never deal with raw function names:

```ts
// src/services/user-service.ts
import { executeFn } from 'gas-react-core/client';

export const getUsers = () => executeFn<User[]>('getUsers');
export const getUserById = (id: string) => executeFn<User>('getUserById', [id]);
export const createUser = (data: User) => executeFn<User>('createUser', [data]);
```

```tsx
// src/pages/Users.tsx
import { getUsers } from '../services/user-service';

const users = await getUsers(); // Fully typed
```

---

## Server — DataStore

Generic CRUD for Google Sheets. Each sheet is a "table" — row 1 is headers, rows 2+ are data.

```ts
import { DataStore } from 'gas-react-core/server';

// Read all rows
const users = DataStore.getAll<User>('users');

// Find by field
const admins = DataStore.findBy<User>('users', 'role', 'admin');

// Find by ID
const user = DataStore.findById<User>('users', 'abc123');

// Insert
DataStore.insert('users', { id: 'xyz', name: 'Alice', role: 'admin' });

// Bulk insert
DataStore.insert('users', [
  { id: '1', name: 'Bob', role: 'viewer' },
  { id: '2', name: 'Carol', role: 'editor' },
]);

// Update by field
DataStore.update('users', 'id', 'xyz', { role: 'editor' });

// Remove by field
DataStore.remove('users', 'id', 'xyz');

// Ensure a sheet with headers exists
DataStore.ensureTable('users', ['id', 'name', 'email', 'role']);
```

### API

| Method | Description |
|---|---|
| `getAll<T>(table)` | Returns all rows as typed objects |
| `findBy<T>(table, field, value)` | Filter rows where `field === value` |
| `findById<T>(table, id)` | Shorthand for `findBy(table, 'id', id)[0]` |
| `insert(table, rows)` | Append one or more rows |
| `update(table, field, value, updates)` | Update matching rows in-place |
| `remove(table, field, value)` | Delete matching rows |
| `ensureTable(table, headers)` | Create sheet with headers if missing |

---

## Server — Cache

Wrapper around GAS `CacheService` with JSON serialization.

> **Nothing is cached automatically.** You decide what to cache by using `withCache` or `getFromCache`/`putInCache` in your server functions. `DataStore` always hits Google Sheets directly — caching is an opt-in layer you apply on top.

```ts
import { initCache, getFromCache, putInCache, removeFromCache, withCache } from 'gas-react-core/server';

// Initialize (call once in your server entry)
// - config: map of cache keys → { key, duration } (provides default TTLs)
// - enabled: global kill switch (false = all cache ops become no-ops)
initCache({
  'all-users': { key: 'all-users', duration: 300 },
  'all-products': { key: 'all-products', duration: 600 },
}, true);

// Manual get/put
const data = getFromCache<User[]>('all-users');
putInCache('all-users', users, 600); // 600s TTL (overrides default)

// Fetch-through pattern (recommended)
// Checks cache first → on miss, calls fetchFunction → stores result → returns it
const users = withCache({
  cacheKey: 'all-users',
  fetchFunction: () => DataStore.getAll<User>('users'),
  duration: 300,
});
```

### Typical usage pattern

```ts
// READ — wrap with withCache to serve from cache when available
function getUsers() {
  return withCache({
    cacheKey: 'all-users',
    fetchFunction: () => DataStore.getAll<User>('users'),
  });
}

// WRITE — update the sheet, then invalidate the cache
function createUser(data: User) {
  DataStore.insert('users', data);
  removeFromCache('all-users'); // next getUsers() call will re-fetch from Sheets
}
```

### `enabled: false` — kill switch

```ts
initCache({ ... }, false);
// Now all cache functions become no-ops:
// - getFromCache() always returns null
// - putInCache() does nothing
// - withCache() always calls fetchFunction directly
// Useful for debugging or when you want to bypass caching entirely.
```

### API

| Function | Description |
|---|---|
| `initCache(config, enabled)` | Register cache keys with default TTLs and enable/disable caching globally. `config` is `Record<string, { key: string; duration: number }>`. |
| `getFromCache<T>(key, suffix?)` | Get cached value (returns `null` on miss or if disabled) |
| `putInCache(key, data, duration?, suffix?)` | Store value with TTL. Falls back to config duration, then 21600s (6h). |
| `removeFromCache(key, suffix?)` | Invalidate a cache entry |
| `clearAllCache()` | Clear all cached keys registered in config |
| `withCache({ cacheKey, fetchFunction, duration })` | Cache-aside: return cached value if available, otherwise fetch → cache → return |

---

## Server — initApp

Helper to create the `doGet()` entry point with proper configuration.

```ts
import { initApp } from 'gas-react-core/server';

const app = initApp({
  title: 'My App',
  htmlEntry: 'index',           // optional, default: 'index'
  metaTags: {                   // optional
    description: 'My GAS app',
  },
});

function doGet(e) {
  return app.doGet(e);
}
```

---

## Full Example

**Server** (`src/server/index.ts` → bundled into `Code.js`):

```ts
import { DataStore, initCache, withCache, removeFromCache, initApp } from 'gas-react-core/server';

// Initialize cache with default TTLs per key
initCache({
  'all-users': { key: 'all-users', duration: 300 },
}, true);

// Initialize the web app
const app = initApp({ title: 'My App' });
export function doGet(e: unknown) { return app.doGet(e); }

// READ — served from cache when available
export function getUsers() {
  return withCache({
    cacheKey: 'all-users',
    fetchFunction: () => DataStore.getAll('users'),
  });
}

// WRITE — update sheet, then invalidate cache
export function createUser(data: Record<string, unknown>) {
  DataStore.insert('users', data);
  removeFromCache('all-users');
  return { success: true };
}
```

**Service** (`src/services/user-service.ts` → bundled into client JS):

```ts
import { executeFn } from 'gas-react-core/client';

export const getUsers = () => executeFn<User[]>('getUsers');
export const createUser = (data: User) => executeFn('createUser', [data]);
```

**Component** (`src/pages/Users.tsx`):

```tsx
import { getUsers } from '../services/user-service';

export default function Users() {
  const [users, setUsers] = useState([]);
  useEffect(() => { getUsers().then(setUsers); }, []);
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

## License

MIT
