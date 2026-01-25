import { z } from 'zod';

/**
 * @deprecated Use jsonb() column type instead
 *
 * This function is no longer needed as JSON deserialization
 * is now handled at the column definition level using the
 * custom jsonb() column type.
 *
 * Migration:
 * - Old: text('data', { mode: 'json' }).$type<T>() + jsonSchema(schema)
 * - New: jsonb<T>() + schema (no wrapper needed)
 *
 * @example
 * // Before (deprecated)
 * const ConfigSchema = jsonSchema(z.object({
 *   enabled: z.boolean(),
 * }));
 *
 * // After (recommended)
 * const ConfigSchema = z.object({
 *   enabled: z.boolean(),
 * });
 */
export function jsonSchema<T extends z.ZodTypeAny>(schema: T): T {
  // No longer performs any preprocessing - just returns the schema
  return schema;
}

/**
 * @deprecated Use jsonb() column type with schema.nullable().optional() instead
 */
export function jsonSchemaOptional<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullable().optional();
}

/**
 * @deprecated Use jsonb() column type with schema.catch() instead
 */
export function jsonSchemaWithDefault<T extends z.ZodTypeAny>(schema: T, defaultValue: z.infer<T>) {
  return schema.catch(defaultValue);
}
