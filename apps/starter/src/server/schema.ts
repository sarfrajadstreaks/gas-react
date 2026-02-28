import { FIELD_TYPES } from '@gas-framework/core/server';
import type { AppSchema } from '@gas-framework/core/server';

/**
 * App-specific table schemas.
 * Define your data model here — the repository validates against these.
 */
export const APP_SCHEMA: AppSchema = {
  ITEMS: {
    tableName: 'items',
    fields: {
      id: { type: FIELD_TYPES.STRING, required: true, description: 'Unique item ID' },
      name: { type: FIELD_TYPES.STRING, required: true, description: 'Item name' },
      category: { type: FIELD_TYPES.STRING, required: false, description: 'Item category' },
      quantity: { type: FIELD_TYPES.NUMBER, required: false, default: 0, description: 'Current quantity' },
      notes: { type: FIELD_TYPES.STRING, required: false, description: 'Additional notes' },
      createdAt: { type: FIELD_TYPES.DATE, required: true, description: 'Created timestamp' },
      updatedAt: { type: FIELD_TYPES.DATE, required: false, description: 'Last updated' },
    },
  },

  USERS: {
    tableName: 'users',
    fields: {
      id: { type: FIELD_TYPES.STRING, required: true },
      email: { type: FIELD_TYPES.STRING, required: true },
      name: { type: FIELD_TYPES.STRING, required: false, default: '' },
      contact: { type: FIELD_TYPES.STRING, required: false, default: '' },
      role: { type: FIELD_TYPES.STRING, required: true, default: 'New' },
      status: { type: FIELD_TYPES.STRING, required: true, default: 'Inactive' },
      profileImage: { type: FIELD_TYPES.STRING, required: false },
      createdAt: { type: FIELD_TYPES.DATE, required: true },
      updatedAt: { type: FIELD_TYPES.DATE, required: false },
    },
  },

  ROLES: {
    tableName: 'roles',
    fields: {
      id: { type: FIELD_TYPES.STRING, required: true },
      name: { type: FIELD_TYPES.STRING, required: true },
      dashboard: { type: FIELD_TYPES.BOOLEAN, required: false, default: false },
      items: { type: FIELD_TYPES.BOOLEAN, required: false, default: false },
      settings: { type: FIELD_TYPES.BOOLEAN, required: false, default: false },
      createdAt: { type: FIELD_TYPES.DATE, required: true },
      updatedAt: { type: FIELD_TYPES.DATE, required: false },
    },
  },

  CONFIG: {
    tableName: 'config',
    fields: {
      id: { type: FIELD_TYPES.STRING, required: true },
      brandName: { type: FIELD_TYPES.STRING, required: false },
      subTitle: { type: FIELD_TYPES.STRING, required: false },
      brandLogo: { type: FIELD_TYPES.STRING, required: false },
      createdAt: { type: FIELD_TYPES.DATE, required: true },
      updatedAt: { type: FIELD_TYPES.DATE, required: false },
    },
  },
};
