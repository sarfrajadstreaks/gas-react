# GAS Framework

**Build full-stack web apps on Google Apps Script with React, TypeScript, and zero infrastructure.**

> Write modern React + TypeScript. Build. Deploy to GAS. Get auth, data layer, and UI components out of the box.

---

## The Problem

Google Apps Script is the only free, zero-infrastructure way to deploy web apps backed by Google Sheets. But building anything serious on it means:

- Writing vanilla JS with no type safety
- Managing global scope spaghetti
- Copy-pasting the same auth, CRUD, and UI boilerplate across projects
- No component system, no bundling, no dev server
- Deploying raw `.gs` and `.html` files via `clasp push`

Every GAS web app reinvents the same wheel: authentication, spreadsheet CRUD, toast notifications, modal dialogs, data tables, role-based access.

## The Vision

**GAS Framework** gives you a professional development experience for GAS web apps:

```
React + TypeScript → Build → GAS-ready output → clasp push → Live web app
```

You write a modern React SPA with full type safety. The build pipeline produces two artifacts:

1. **`index.html`** — Your entire React app inlined into a single HTML file (Vite + vite-plugin-singlefile)
2. **`Code.js`** — Your server-side TypeScript bundled into GAS-compatible global functions (esbuild + esbuild-gas-plugin)

That's it. `clasp push` from the `dist/` folder and you have a deployed web app.

## What You Get For Free

### Server Side (`@gas-framework/core/server`)

| Module | What it does |
|---|---|
| **Repository** | Typed CRUD for Google Sheets — `findAll<T>()`, `find()`, `insert()`, `update()`, `delete()` |
| **Schema Engine** | Define table schemas with types, required fields, defaults, enums. Auto-validates on every write. |
| **Auth Service** | Email-based OTP login. Token generation/validation. Branded OTP emails from your config. |
| **Access Control** | Role-based permissions. Define permission keys, assign to roles, check access. |
| **Cache Manager** | GAS CacheService wrapper. Cache-on-read, invalidate-on-write. Config-driven per table. |
| **Data Change Service** | Change timestamp tracking. Client polls to detect stale data and refresh. |
| **Drive Service** | Upload/download/delete files from Google Drive. Image handling with base64 conversion. |
| **App Engine** | `doGet()` and `runLibraryFunction()` — the two GAS entry points, configured once. |

### Client Side (`@gas-framework/core/client`)

| Module | What it does |
|---|---|
| **`useExecuteFn`** | Hook that calls GAS server functions with loading/error state. Dev-mode HTTP fallback. |
| **`useAuth`** | Login state management. Token persistence. Session validation. |
| **`useDataPolling`** | Auto-refresh when server data changes. |
| **`useToast`** | Toast notification state management. |
| **`GASAppProvider`** | React context provider — injects config + auth into your component tree. |
| **`Modal`** | General-purpose modal dialog. |
| **`ConfirmDialog`** | Confirm/cancel dialog with danger variant. |
| **`DataTable`** | Generic data table with formatting, row clicks, empty states. |
| **`ToastContainer`** | Animated toast notification display. |
| **`StatCard`** | Dashboard metric card with trends. |
| **`Loader`** | Loading spinner (inline or full-page). |

## Project Structure

```
gas-framework/
├── packages/
│   └── core/                    ← The npm package: @gas-framework/core
│       ├── src/
│       │   ├── server/          ← Runs in GAS V8 runtime
│       │   │   ├── repository/  ← Sheet CRUD + schema validation
│       │   │   ├── auth/        ← OTP login + token management
│       │   │   ├── cache/       ← CacheService wrapper
│       │   │   ├── access/      ← Role-based permissions
│       │   │   ├── drive/       ← Google Drive file operations
│       │   │   ├── data-change/ ← Change tracking for polling
│       │   │   └── app-engine/  ← doGet + RPC bridge
│       │   ├── client/          ← Runs in browser (React)
│       │   │   ├── hooks/       ← useExecuteFn, useAuth, useToast, useDataPolling
│       │   │   ├── components/  ← Modal, DataTable, Toast, Loader, StatCard, etc.
│       │   │   ├── providers/   ← GASAppProvider (config + auth context)
│       │   │   └── lib/         ← executeFn bridge (GAS ↔ dev server)
│       │   ├── types/           ← Shared types (config, GAS stubs)
│       │   └── build/           ← Build utilities (Vite + esbuild configs)
│       └── package.json
│
└── apps/
    └── starter/                 ← Example app using the framework
        ├── src/
        │   ├── app.config.ts    ← App name, pages, permissions, cache, auth settings
        │   ├── server/
        │   │   ├── schema.ts    ← Your table definitions
        │   │   └── index.ts     ← Your server functions (become GAS globals)
        │   └── client/
        │       ├── App.tsx      ← Your React app
        │       └── pages/       ← Your page components
        ├── dist/                ← Build output → clasp push from here
        │   ├── index.html       ← Entire React app (JS/CSS inlined)
        │   ├── Code.js          ← Bundled server code (global functions)
        │   └── appsscript.json
        └── appsscript.json
```

## Quick Start

### 1. Define your config

```typescript
// src/app.config.ts
export const appConfig: GASFrameworkConfig = {
  name: 'My App',
  auth: { tokenKey: 'myAppToken', tokenExpiryHours: 24, otpExpiryMinutes: 10 },
  pages: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', permission: 'dashboard', default: true },
    { id: 'orders',    label: 'Orders',    icon: '🛒', permission: 'orders' },
  ],
  permissions: ['dashboard', 'orders'],
  dataChangeKeys: ['ORDERS'],
};
```

### 2. Define your schema

```typescript
// src/server/schema.ts
export const APP_SCHEMA: AppSchema = {
  ORDERS: {
    tableName: 'orders',
    fields: {
      id: { type: FIELD_TYPES.STRING, required: true },
      customer: { type: FIELD_TYPES.STRING, required: true },
      total: { type: FIELD_TYPES.NUMBER, required: true },
      status: { type: FIELD_TYPES.ENUM, required: true, enum: ['Pending', 'Completed', 'Cancelled'] },
      createdAt: { type: FIELD_TYPES.DATE, required: true },
    },
  },
};
```

### 3. Write server functions

```typescript
// src/server/index.ts
import { createRepository, createAppEngine, requireAuth } from '@gas-framework/core/server';

const repo = createRepository(APP_SCHEMA);
const engine = createAppEngine(appConfig);

// Every export becomes a GAS global → callable from client directly
export const doGet = engine.doGet;

export function getOrders(token: string) {
  requireAuth(token);
  return repo.getDb().findAll<Order>('orders');
}

export function createOrder(data: OrderInput, token: string) {
  requireAuth(token);
  return repo.getDb().insert('orders', [data]);
}
```

### 4. Build React pages

```tsx
// src/client/pages/Orders.tsx
import { useExecuteFn, DataTable, useAppAuth } from '@gas-framework/core/client';

export function Orders() {
  const { token } = useAppAuth();
  const { data, loading } = useExecuteFn<Order[]>('getOrders', [token]);

  if (loading) return <Loader />;

  return (
    <DataTable
      data={data ?? []}
      columns={[
        { key: 'customer', label: 'Customer' },
        { key: 'total', label: 'Total', format: 'currency' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
```

### 5. Build & Deploy

```bash
npm run build    # → dist/index.html + dist/Code.js
cd dist && clasp push
```

## Roadmap

### Phase 1 — Foundation (current)
- [x] Project scaffold (monorepo, TypeScript, build pipeline)
- [x] Server: Repository + Schema Engine
- [x] Server: Auth Service (OTP + tokens)
- [x] Server: Cache Manager, Access Control, Data Change Service, Drive Service
- [x] Client: `useExecuteFn`, `useAuth`, `useToast`, `useDataPolling` hooks
- [x] Client: Modal, ConfirmDialog, DataTable, Toast, Loader, StatCard components
- [x] Client: GASAppProvider (config + auth context)
- [x] Starter app demonstrating all features

### Phase 2 — Dev Experience
- [ ] Local dev server with GAS function mocking
- [ ] Hot reload with Vite dev server
- [ ] Mock data layer (in-memory Sheets simulator)
- [ ] CLI tool: `npx create-gas-app my-app`

### Phase 3 — Code Splitting & Performance
- [ ] Lazy page loading (React.lazy + Suspense)
- [ ] Route-based code splitting with chunk inlining
- [ ] Initial bundle size optimization
- [ ] Preload strategies for anticipated navigations
- [ ] Server-side HTML template splitting (load page HTML on demand)

### Phase 4 — Advanced Features
- [ ] Form builder component (config-driven forms)
- [ ] File upload component with Drive integration
- [ ] Calendar component
- [ ] Chart/analytics components
- [ ] Real-time collaboration via polling optimization
- [ ] Multi-language (i18n) support

### Phase 5 — Ecosystem
- [ ] Publish `@gas-framework/core` to npm
- [ ] Documentation site
- [ ] Template gallery (restaurant, school, clinic, etc.)
- [ ] VS Code extension for GAS Framework projects
- [ ] GitHub template repository

## Why GAS?

Google Apps Script remains unique: **free hosting, free database (Sheets), built-in auth (Google accounts), zero DevOps.** For internal tools, small business apps, and MVPs, nothing else comes close to the price-performance ratio. This framework makes building on it a first-class developer experience.

## Tech Stack

- **React 19** — UI framework
- **TypeScript** — Type safety across server and client
- **Vite** — Client dev server and bundler
- **vite-plugin-singlefile** — Inlines all JS/CSS into single HTML (GAS requirement)
- **esbuild** — Server bundler (TS → GAS-compatible JS)
- **esbuild-gas-plugin** — Converts ES module exports to GAS global functions
- **pnpm workspaces** — Monorepo management
- **tsup** — Framework package bundler
- **clasp** — GAS deployment CLI

## License

MIT
