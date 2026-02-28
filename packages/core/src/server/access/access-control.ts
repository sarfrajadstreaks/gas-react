/**
 * Access Control — Role-based permission system.
 *
 * When creating the access control service, pass the permission keys your app uses.
 * The framework reads role definitions from a 'roles' table in Sheets where each
 * column is a permission key with boolean values.
 */

import type { Repository } from '../repository/repository';

export interface AccessControl {
  getRolePermissions(roleName: string): Record<string, boolean>;
  hasFeatureAccess(email: string, feature: string): boolean;
  getUserRole(email: string): string | null;
}

export function createAccessControl(
  getDb: () => Repository,
  permissionKeys: string[]
): AccessControl {
  function getUserRole(email: string): string | null {
    try {
      const users = getDb().find<{ email: string; role: string }>('users', 'email', email);
      return users.length > 0 ? users[0].role : null;
    } catch {
      return null;
    }
  }

  function getRolePermissions(roleName: string): Record<string, boolean> {
    const defaults: Record<string, boolean> = {};
    permissionKeys.forEach((key) => (defaults[key] = false));

    try {
      const roles = getDb().find<Record<string, unknown>>('roles', 'name', roleName);
      if (!roles.length) return defaults;

      const role = roles[0];
      const result: Record<string, boolean> = {};
      permissionKeys.forEach((key) => {
        result[key] = Boolean(role[key]);
      });
      return result;
    } catch {
      return defaults;
    }
  }

  function hasFeatureAccess(email: string, feature: string): boolean {
    const role = getUserRole(email);
    if (!role) return false;
    if (role === 'Super Admin') return true;
    const perms = getRolePermissions(role);
    return perms[feature] ?? false;
  }

  return { getRolePermissions, hasFeatureAccess, getUserRole };
}
