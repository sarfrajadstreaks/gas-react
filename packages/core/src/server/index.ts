// ─── Server Entry Point ─────────────────────────────────────────────────────
//
// Everything the app's server code needs from the framework.

// App engine (doGet entry point)
export { createAppEngine } from './app-engine';
export type { AppEngine } from './app-engine';

// Library Proxy (for GAS Library deployment mode)
export { createLibraryProxy } from './app-engine';
export type { LibraryProxy } from './app-engine';

// Repository (typed CRUD for Google Sheets)
export { createRepository } from './repository';
export type { Repository } from './repository';

// Schema engine
export { FIELD_TYPES, validateRecord, getSchemaForTable, applyDefaults } from './repository';
export type { TableSchema, FieldDefinition, AppSchema } from './repository';

// Auth
export { createAuthService, requireAuth, validateAuthToken, generateAuthToken } from './auth';
export type { AuthService, TokenPayload } from './auth';

// Cache
export { initCache, isCacheEnabled, getFromCache, putInCache, removeFromCache, clearAllCache, withCache } from './cache';

// Access Control (RBAC)
export { createAccessControl } from './access';
export type { AccessControl } from './access';

// Data Change Tracking
export { createDataChangeService } from './data-change';
export type { DataChangeTracker } from './data-change';

// Drive Service
export { createDriveService } from './drive';
export type { DriveService } from './drive';
