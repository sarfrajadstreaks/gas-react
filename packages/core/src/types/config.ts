// ─── Field & Schema Types ───────────────────────────────────────────────────

export const FIELD_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'boolean',
  ENUM: 'enum',
  OBJECT: 'object',
  ARRAY: 'array',
} as const;

export type FieldType = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];

export interface FieldDefinition {
  type: FieldType;
  required: boolean;
  default?: unknown;
  enum?: readonly string[];
  description?: string;
}

export interface TableSchema {
  tableName: string;
  fields: Record<string, FieldDefinition>;
}

export type AppSchema = Record<string, TableSchema>;

// ─── Page Configuration ─────────────────────────────────────────────────────

export interface PageConfig {
  /** Unique page identifier (used in routing and DOM) */
  id: string;
  /** Display label in navigation */
  label: string;
  /** Emoji or icon identifier */
  icon: string;
  /** Permission key needed to access this page */
  permission: string;
  /** Whether this is the default landing page */
  default?: boolean;
}

// ─── Cache Configuration ────────────────────────────────────────────────────

export interface CacheEntry {
  key: string;
  duration: number; // seconds
}

export type CacheConfig = Record<string, CacheEntry>;

// ─── Auth Configuration ─────────────────────────────────────────────────────

export interface AuthConfig {
  /** Key used for sessionStorage token */
  tokenKey: string;
  /** Token validity in hours */
  tokenExpiryHours: number;
  /** OTP validity in minutes */
  otpExpiryMinutes: number;
  /** Max OTP attempts before lockout */
  otpMaxAttempts?: number;
  /** Max OTP requests per hour */
  otpRequestLimitPerHour?: number;
}

// ─── Email Template Configuration ───────────────────────────────────────────

export interface EmailConfig {
  /** App name shown in emails */
  appName: string;
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** Gradient start color */
  gradientStart?: string;
  /** Gradient end color */
  gradientEnd?: string;
  /** App icon/emoji for email header */
  headerIcon?: string;
}

// ─── Top-Level App Configuration ────────────────────────────────────────────

export interface GASFrameworkConfig {
  /** Application display name */
  name: string;

  /** Authentication settings */
  auth: AuthConfig;

  /** Email template branding */
  email?: EmailConfig;

  /** Page definitions (order = nav order) */
  pages: PageConfig[];

  /** Permission keys used across the app */
  permissions: string[];

  /** Data change tracking keys */
  dataChangeKeys: string[];

  /** Cache configuration per data type */
  cache?: CacheConfig;
}
