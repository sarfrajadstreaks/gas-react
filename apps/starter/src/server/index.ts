/**
 * Server entry point — all exported functions become GAS globals.
 *
 * After esbuild + esbuild-gas-plugin bundles this file, each `export function`
 * becomes a top-level GAS global, directly callable from the client via:
 *   google.script.run.functionName(arg1, arg2)
 *   executeFn('functionName', [arg1, arg2])   // React hook wrapper
 *
 * No proxy/dispatcher needed — this is NOT a GAS Library.
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

// ─── GAS entry point ────────────────────────────────────────────────────────

const engine = createAppEngine(appConfig);

/** Web app entry — serves the React SPA */
export const doGet = engine.doGet;

// ─── Exported functions (each becomes a GAS global) ─────────────────────────
// The client calls these directly: google.script.run.login(email)

export function login(email: string) {
  return auth.login(email);
}

export function verifyOTP(email: string, otp: string) {
  return auth.verifyOTP(email, otp);
}

export function validateSession(token: string) {
  return auth.validateToken(token);
}

export function getUserProfile(token: string) {
  const payload = requireAuth(token);
  const users = getDb().find<Record<string, unknown>>('users', 'email', payload.email);
  if (!users.length) return { success: false, message: 'User not found' };
  const user = users[0];
  const permissions = access.getRolePermissions((user.role as string) ?? 'New');
  return { success: true, email: user.email, name: user.name, role: user.role, permissions };
}

export function getDataChangeTimestamps(token: string) {
  return dataChange.getTimestamps(token);
}

export { getItems, createItem, deleteItem };
