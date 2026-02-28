/**
 * Server entry point — all exported functions become GAS globals.
 *
 * After esbuild bundles this file, each `export function` is available
 * to call from the client via `executeFn('functionName', args)`.
 */

import {
  createAppEngine,
  createRepository,
  createAuthService,
  createAccessControl,
  createDataChangeService,
  createDriveService,
  requireAuth,
} from '@gas-framework/core/server';
import { appConfig } from '../app.config';
import { APP_SCHEMA } from './schema';

// ─── Initialize framework services ─────────────────────────────────────────

const repo = createRepository(APP_SCHEMA);
const getDb = () => repo.getDb();

const auth = createAuthService(
  appConfig.auth,
  appConfig.email ?? { appName: appConfig.name },
  {
    checkUserStatus(email: string) {
      const users = getDb().find<{ email: string; role: string; status: string }>('users', 'email', email);
      if (users.length === 0) return { exists: false, isActive: false };
      return { exists: true, isActive: users[0].status === 'Active', role: users[0].role };
    },
    addUserAsInactive(email: string) {
      getDb().insert('users', [{ email, role: 'New', status: 'Inactive' }]);
    },
  }
);

const access = createAccessControl(getDb, appConfig.permissions);

const dataChangeKeys: Record<string, string> = {};
appConfig.dataChangeKeys.forEach((key) => {
  dataChangeKeys[key] = `ts_${key.toLowerCase()}`;
});
const dataChange = createDataChangeService(dataChangeKeys, requireAuth);

const drive = createDriveService();

// ─── App-specific service functions ─────────────────────────────────────────

function getItems(token: string) {
  requireAuth(token);
  return getDb().findAll('items');
}

function createItem(itemData: Record<string, unknown>, token: string) {
  requireAuth(token);
  getDb().insert('items', [itemData]);
  dataChange.markChanged('ITEMS');
  return { success: true, message: 'Item created' };
}

function deleteItem(itemId: string, token: string) {
  requireAuth(token);
  getDb().delete('items', 'id', itemId);
  dataChange.markChanged('ITEMS');
  return { success: true, message: 'Item deleted' };
}

// ─── Function registry ──────────────────────────────────────────────────────

const functions: Record<string, (...args: unknown[]) => unknown> = {
  // Auth
  login: (email: unknown) => auth.login(email as string),
  verifyOTP: (email: unknown, otp: unknown) => auth.verifyOTP(email as string, otp as string),
  validateSession: (token: unknown) => auth.validateToken(token as string),

  // Access
  getUserProfile: (token: unknown) => {
    const payload = requireAuth(token as string);
    const users = getDb().find<Record<string, unknown>>('users', 'email', payload.email);
    if (!users.length) return { success: false, message: 'User not found' };
    const user = users[0];
    const permissions = access.getRolePermissions((user.role as string) ?? 'New');
    return { success: true, email: user.email, name: user.name, role: user.role, permissions };
  },

  // Data change polling
  getDataChangeTimestamps: (token: unknown) => dataChange.getTimestamps(token as string),

  // App-specific
  getItems: (token: unknown) => getItems(token as string),
  createItem: (itemData: unknown, token: unknown) => createItem(itemData as Record<string, unknown>, token as string),
  deleteItem: (itemId: unknown, token: unknown) => deleteItem(itemId as string, token as string),
};

// ─── GAS entry points ───────────────────────────────────────────────────────

const engine = createAppEngine(appConfig, functions);

export const doGet = engine.doGet;
export const runLibraryFunction = engine.runLibraryFunction;
