# @sarfrajakhtar/gas-core

**Client-server bridge and server utilities for Google Apps Script React apps.**

> Call GAS server functions from React with full TypeScript support. Read/write Google Sheets with zero boilerplate.

---

## Install

```bash
npm install @sarfrajakhtar/gas-core
```

## Two Entry Points

| Import | Runs In | Purpose |
|---|---|---|
| `@sarfrajakhtar/gas-core/client` | Browser (React) | Call server functions via `google.script.run` |
| `@sarfrajakhtar/gas-core/server` | GAS runtime | Sheet CRUD, caching, app initialization |

---

## Client — `executeFn`

A typed wrapper around `google.script.run` that returns Promises.

```ts
import { executeFn } from '@sarfrajakhtar/gas-core/client';

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
import { configureExecution, executeFn } from '@sarfrajakhtar/gas-core/client';

// Direct mode (default) — calls server functions directly
configureExecution({ mode: 'direct' });

// Library mode — routes through runLibraryFunction() proxy
configureExecution({ mode: 'library' });
```

### Service Layer Pattern

Create a typed service layer so your components never deal with raw function names:

```ts
// src/services/user-service.ts
import { executeFn } from '@sarfrajakhtar/gas-core/client';

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
import { DataStore } from '@sarfrajakhtar/gas-core/server';

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

```ts
import { initCache, getFromCache, putInCache, withCache } from '@sarfrajakhtar/gas-core/server';

// Initialize (call once in your server entry)
initCache({ defaultDuration: 300 }, true);

// Manual get/put
const data = getFromCache<User[]>('all-users');
putInCache('all-users', users, 600); // 600s TTL

// Fetch-through pattern
const users = withCache({
  cacheKey: 'all-users',
  fetchFunction: () => DataStore.getAll<User>('users'),
  duration: 300,
});
```

### API

| Function | Description |
|---|---|
| `initCache(config, enabled)` | Set default duration and enable/disable |
| `getFromCache<T>(key, suffix?)` | Get cached value (returns `null` if miss) |
| `putInCache(key, data, duration?, suffix?)` | Store value with TTL |
| `removeFromCache(key, suffix?)` | Invalidate a cache entry |
| `clearAllCache()` | Clear all cached data |
| `withCache({ cacheKey, fetchFunction, duration })` | Cache-aside pattern |

---

## Server — initApp

Helper to create the `doGet()` entry point with proper configuration.

```ts
import { initApp } from '@sarfrajakhtar/gas-core/server';

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
import { DataStore } from '@sarfrajakhtar/gas-core/server';

export function getUsers() {
  return DataStore.getAll('users');
}

export function createUser(data: Record<string, unknown>) {
  DataStore.insert('users', data);
  return { success: true };
}
```

**Service** (`src/services/user-service.ts` → bundled into client JS):

```ts
import { executeFn } from '@sarfrajakhtar/gas-core/client';

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
