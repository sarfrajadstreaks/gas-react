import type { GASFrameworkConfig } from '@gas-framework/core/config';

export const appConfig: GASFrameworkConfig = {
  name: 'My GAS App',

  auth: {
    tokenKey: 'myGasAppAuthToken',
    tokenExpiryHours: 24,
    otpExpiryMinutes: 10,
    otpMaxAttempts: 3,
    otpRequestLimitPerHour: 5,
  },

  email: {
    appName: 'My GAS App',
    headerIcon: '🚀',
    primaryColor: '#3b82f6',
    gradientStart: '#3b82f6',
    gradientEnd: '#8b5cf6',
  },

  pages: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', permission: 'dashboard', default: true },
    { id: 'items',     label: 'Items',     icon: '📦', permission: 'items' },
    { id: 'settings',  label: 'Settings',  icon: '⚙️', permission: 'settings' },
  ],

  permissions: ['dashboard', 'items', 'settings'],

  dataChangeKeys: ['ITEMS', 'DASHBOARD'],

  cache: {
    ITEMS: { key: 'items_list', duration: 21600 },
  },
};
