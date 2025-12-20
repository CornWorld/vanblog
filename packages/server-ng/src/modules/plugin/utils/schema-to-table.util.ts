/**
 * @file schema-to-table.util.ts
 *
 * Zod Schema → Drizzle Table 转换工具
 *
 * 提供从 Zod Schema 动态生成 Drizzle 表定义的功能
 */

import { Logger } from '@nestjs/common';
import { nowIsoTz } from '@vanblog/shared';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

import type { z } from 'zod';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';

const logger = new Logger('SchemaToTableUtil');

/**
 * Zod 内部定义类型（用于访问 _def）
 */
interface ZodDef {
  typeName: string;
  innerType?: z.ZodTypeAny;
  defaultValue?: () => unknown;
  shape?: Record<string, z.ZodTypeAny> | (() => Record<string, z.ZodTypeAny>);
  checks?: Array<{ kind: string; value?: unknown }>;
  type?: z.ZodTypeAny;
}

/**
 * Drizzle Column 类型（简化）
 */
type DrizzleColumn = ReturnType<typeof text> | ReturnType<typeof integer> | ReturnType<typeof real>;

/**
 * Zod 类型名称
 */
type ZodTypeName =
  | 'ZodString'
  | 'ZodNumber'
  | 'ZodBoolean'
  | 'ZodDate'
  | 'ZodArray'
  | 'ZodObject'
  | 'ZodOptional'
  | 'ZodNullable'
  | 'ZodDefault'
  | 'ZodLiteral'
  | 'ZodEnum'
  | 'ZodUnion';

/**
 * 获取 Zod Schema 的类型名称
 */
function getZodTypeName(schema: z.ZodTypeAny): ZodTypeName {
  return (schema._def as ZodDef).typeName as ZodTypeName;
}

/**
 * 从 Zod Schema 生成 Drizzle 表
 *
 * @param tableName - 表名
 * @param schema - Zod Object Schema
 * @returns Drizzle 表定义
 *
 * @example
 * ```typescript
 * const BookSchema = z.object({
 *   id: z.number(),
 *   title: z.string(),
 *   author: z.string(),
 *   published: z.boolean().optional(),
 * });
 *
 * const bookTable = createTableFromSchema('books', BookSchema);
 * ```
 */
/**
 * 获取 Zod Object Schema 的 shape
 * 兼容 Zod 3 (shape 是函数) 和 Zod 4 (shape 是属性)
 */
function getZodShape(schema: z.ZodObject<z.ZodRawShape>): Record<string, z.ZodTypeAny> {
  const def = schema._def as ZodDef;
  // Zod 3: shape is a function, Zod 4: shape is a property
  return typeof def.shape === 'function' ? def.shape() : (def.shape ?? {});
}

export function createTableFromSchema(
  tableName: string,
  schema: z.ZodObject<z.ZodRawShape>,
): SQLiteTableWithColumns<{
  name: string;
  schema: undefined;
  columns: Record<string, DrizzleColumn>;
  dialect: 'sqlite';
}> {
  const shape = getZodShape(schema);
  const columns: Record<string, DrizzleColumn> = {};

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const column = zodSchemaToColumn(key, fieldSchema);
    if (column) {
      columns[key] = column;
    }
  }

  // 自动添加 createdAt 和 updatedAt 字段（如果不存在）
  if (!columns.createdAt) {
    columns.createdAt = text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz());
  }
  if (!columns.updatedAt) {
    columns.updatedAt = text('updated_at')
      .notNull()
      .$defaultFn(() => nowIsoTz());
  }

  return sqliteTable(tableName, columns);
}

/**
 * 将 Zod Schema 转换为 Drizzle Column
 *
 * @param columnName - 列名
 * @param schema - Zod Schema
 * @returns Drizzle Column 定义
 */
function zodSchemaToColumn(columnName: string, schema: z.ZodTypeAny): DrizzleColumn | null {
  const typeName = getZodTypeName(schema);

  // 处理 Optional、Nullable、Default 包装器
  if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
    const innerSchema = (schema._def as ZodDef).innerType;
    if (!innerSchema) return null;
    const column = zodSchemaToColumn(columnName, innerSchema);
    // Optional/Nullable 不需要 notNull()
    return column;
  }

  if (typeName === 'ZodDefault') {
    const def = schema._def as ZodDef;
    const innerSchema = def.innerType;
    const defaultValue = def.defaultValue?.();
    if (!innerSchema) return null;
    const column = zodSchemaToColumn(columnName, innerSchema);
    // 添加默认值
    if (column && defaultValue !== undefined) {
      return column.default(defaultValue) as DrizzleColumn;
    }
    return column;
  }

  // 基础类型转换
  switch (typeName) {
    case 'ZodString':
      return text(columnName).notNull();

    case 'ZodNumber': {
      // Zod number 可以是整数或浮点数
      // 检查是否有整数限制
      const checks = (schema._def as ZodDef).checks || [];
      const isInteger = checks.some((check) => check.kind === 'int');

      if (isInteger) {
        return integer(columnName).notNull();
      } else {
        return real(columnName).notNull();
      }
    }

    case 'ZodBoolean':
      // SQLite 使用 integer 存储 boolean (0/1)
      return integer(columnName, { mode: 'boolean' }).notNull();

    case 'ZodDate':
      // 存储为 ISO 字符串
      return text(columnName).notNull();

    case 'ZodArray':
    case 'ZodObject':
      // 复杂类型存储为 JSON
      return text(columnName, { mode: 'json' }).notNull();

    case 'ZodEnum':
    case 'ZodLiteral':
      // 枚举和字面量存储为 text
      return text(columnName).notNull();

    case 'ZodUnion':
      // Union 类型简单处理为 text
      return text(columnName).notNull();

    default:
      // 未知类型默认为 text
      logger.warn(`未知的 Zod 类型: ${typeName}，使用 text 列`);
      return text(columnName);
  }
}

/**
 * 检查表是否已存在
 *
 * @param db - Drizzle 数据库实例
 * @param tableName - 表名
 * @returns 表是否存在
 */
export async function tableExists(
  db: { run: (query: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }> },
  tableName: string,
): Promise<boolean> {
  try {
    const result = await db.run({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      args: [tableName],
    });
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * 创建表（如果不存在）
 *
 * @param db - Drizzle 数据库实例
 * @param table - Drizzle 表定义
 */
export async function createTableIfNotExists(
  _db: { run: (query: { sql: string; args: unknown[] }) => Promise<unknown> },
  _table: SQLiteTableWithColumns<{
    name: string;
    schema: undefined;
    columns: Record<string, DrizzleColumn>;
    dialect: 'sqlite';
  }>,
): Promise<void> {
  // Drizzle 会在首次使用时自动创建表
  // 实际实现需要从 Drizzle 表定义生成 CREATE TABLE SQL
  // 在生产环境中，应该使用 drizzle-kit 生成 migration
}

/**
 * 从 Zod Schema 推断 TypeScript 类型
 *
 * @param schema - Zod Schema
 * @returns TypeScript 类型字符串（用于代码生成）
 */
export function zodSchemaToTypeScript(schema: z.ZodObject<z.ZodRawShape>): string {
  const shape = getZodShape(schema);
  const fields: string[] = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const type = zodTypeToTypeScript(fieldSchema);
    fields.push(`  ${key}: ${type};`);
  }

  return `{\n${fields.join('\n')}\n}`;
}

/**
 * 将 Zod 类型转换为 TypeScript 类型字符串
 */
function zodTypeToTypeScript(schema: z.ZodTypeAny): string {
  const typeName = getZodTypeName(schema);

  if (typeName === 'ZodOptional') {
    const innerType = zodTypeToTypeScript((schema._def as ZodDef).innerType!);
    return `${innerType} | undefined`;
  }

  if (typeName === 'ZodNullable') {
    const innerType = zodTypeToTypeScript((schema._def as ZodDef).innerType!);
    return `${innerType} | null`;
  }

  if (typeName === 'ZodDefault') {
    return zodTypeToTypeScript((schema._def as ZodDef).innerType!);
  }

  switch (typeName) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodDate':
      return 'Date';
    case 'ZodArray': {
      const itemType = zodTypeToTypeScript((schema._def as ZodDef).type!);
      return `Array<${itemType}>`;
    }
    case 'ZodObject':
      return 'object';
    case 'ZodEnum':
      return 'string';
    case 'ZodLiteral':
      return 'string';
    case 'ZodUnion':
      return 'unknown';
    default:
      return 'unknown';
  }
}
