import type { TableSchema, AppSchema, FieldDefinition } from '../../types/config';
import { FIELD_TYPES } from '../../types/config';

export { FIELD_TYPES };
export type { TableSchema, FieldDefinition, AppSchema };

/**
 * Validate a record against its table schema.
 * Returns { isValid, msg } — msg describes the first violation found.
 */
export function validateRecord(
  schema: TableSchema,
  record: Record<string, unknown>
): { isValid: boolean; msg: string } {
  const { fields } = schema;

  for (const [fieldName, def] of Object.entries(fields)) {
    const value = record[fieldName];

    // Required check
    if (def.required && (value === undefined || value === null || value === '')) {
      return { isValid: false, msg: `Missing required field '${fieldName}'` };
    }

    // Skip further checks for optional empty values
    if (value === undefined || value === null || value === '') continue;

    // Enum check
    if (def.type === FIELD_TYPES.ENUM && def.enum) {
      if (!def.enum.includes(String(value))) {
        return {
          isValid: false,
          msg: `Field '${fieldName}' must be one of: ${def.enum.join(', ')}`,
        };
      }
    }
  }

  return { isValid: true, msg: '' };
}

/**
 * Get the schema definition for a table by name.
 * Throws if not found.
 */
export function getSchemaForTable(
  appSchema: AppSchema,
  tableName: string
): TableSchema {
  const schema = Object.values(appSchema).find((s) => s.tableName === tableName);
  if (!schema) {
    throw new Error(`No schema defined for table '${tableName}'`);
  }
  return schema;
}

/**
 * Apply defaults from schema to a record.
 */
export function applyDefaults(
  schema: TableSchema,
  record: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...record };
  for (const [fieldName, def] of Object.entries(schema.fields)) {
    if ((result[fieldName] === undefined || result[fieldName] === null) && def.default !== undefined) {
      result[fieldName] = def.default;
    }
  }
  return result;
}
