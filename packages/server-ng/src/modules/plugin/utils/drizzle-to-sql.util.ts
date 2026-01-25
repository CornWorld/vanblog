/**
 * @file drizzle-to-sql.util.ts
 *
 * Drizzle Table 转 SQL 工具
 *
 * 从 Drizzle 表定义生成 SQLite CREATE TABLE SQL 语句
 */

import { Logger } from '@nestjs/common';

import type { DrizzleTable } from '@vanblog/shared/plugin';

const logger = new Logger('DrizzleToSQL');

/**
 * Drizzle 列类型映射到 SQLite 类型
 */
const COLUMN_TYPE_MAP: Record<string, string> = {
  integer: 'INTEGER',
  real: 'REAL',
  text: 'TEXT',
  blob: 'BLOB',
};

/**
 * 从 Drizzle 表生成 CREATE TABLE SQL
 *
 * @param table - Drizzle 表对象
 * @param tableName - 表名
 * @returns CREATE TABLE SQL 语句
 */
export function generateCreateTableSQL(table: DrizzleTable, tableName: string): string {
  logger.debug(`生成表 '${tableName}' 的 CREATE TABLE SQL`);

  // 从 Drizzle 表中提取列信息
  // Drizzle 表结构: table[Symbol.for('drizzle:Table')]
  const tableSymbol = Symbol.for('drizzle:Table');
  const tableConfig = table[tableSymbol];

  if (!tableConfig) {
    logger.error(`无法从表 '${tableName}' 中提取配置`);
    throw new Error(`无法从 Drizzle 表中提取配置: ${tableName}`);
  }

  const columns = tableConfig.columns || [];
  const indexes = tableConfig.indexes || [];
  const primaryKeys = tableConfig.primaryKeys || [];

  logger.debug(`表 '${tableName}' 有 ${columns.length} 个列, ${indexes.length} 个索引`);

  // 构建列定义
  const columnDefinitions: string[] = [];

  for (const col of columns) {
    const columnDef = generateColumnDefinition(col);
    columnDefinitions.push(columnDef);
  }

  // 构建表约束
  const constraints: string[] = [];

  // 处理主键约束
  for (const pk of primaryKeys) {
    if (pk.columns && pk.columns.length > 0) {
      const pkColumns = pk.columns.map((c: any) => c.name).join(', ');
      constraints.push(`PRIMARY KEY (${pkColumns})`);
    }
  }

  // 合并列定义和约束
  const allDefinitions = [...columnDefinitions, ...constraints];

  // 生成 CREATE TABLE 语句
  const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${allDefinitions.join(',\n  ')}\n);`;

  logger.debug(`生成的 SQL:\n${sql}`);

  return sql;
}

/**
 * 生成列定义
 *
 * @param column - Drizzle 列对象
 * @returns SQL 列定义
 */
function generateColumnDefinition(column: any): string {
  const columnName = column.name;
  const columnType = getColumnType(column);

  let definition = `${columnName} ${columnType}`;

  // 处理列约束
  if (column.primary) {
    definition += ' PRIMARY KEY';

    // 自动递增
    if (column.autoIncrement) {
      definition += ' AUTOINCREMENT';
    }
  }

  // NOT NULL 约束
  if (column.notNull) {
    definition += ' NOT NULL';
  }

  // UNIQUE 约束
  if (column.unique) {
    definition += ' UNIQUE';
  }

  // DEFAULT 值
  if (column.default !== undefined) {
    definition += ` DEFAULT ${formatDefaultValue(column.default)}`;
  }

  // 外键约束
  if (column.references) {
    const refTable = column.references.table;
    const refColumn = column.references.column || 'id';
    definition += ` REFERENCES ${refTable}(${refColumn})`;

    if (column.references.onUpdate) {
      definition += ` ON UPDATE ${column.references.onUpdate.toUpperCase()}`;
    }

    if (column.references.onDelete) {
      definition += ` ON DELETE ${column.references.onDelete.toUpperCase()}`;
    }
  }

  return definition;
}

/**
 * 获取列的 SQL 类型
 */
function getColumnType(column: any): string {
  // Drizzle 列有 `type` 属性
  const columnType = column.columnType || column.dataType || 'text';

  // 映射到 SQLite 类型
  const sqlType = COLUMN_TYPE_MAP[columnType.toLowerCase()] || 'TEXT';

  return sqlType;
}

/**
 * 格式化默认值
 */
function formatDefaultValue(value: unknown): string {
  if (typeof value === 'string') {
    return `'${value}'`;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (value === null) {
    return 'NULL';
  }

  // 对于函数默认值（如 CURRENT_TIMESTAMP），直接返回
  if (typeof value === 'function') {
    return 'CURRENT_TIMESTAMP';
  }

  return String(value);
}

/**
 * 从 Drizzle 表生成所有索引的 CREATE INDEX SQL
 *
 * @param table - Drizzle 表对象
 * @param tableName - 表名
 * @returns CREATE INDEX SQL 语句数组
 */
export function generateCreateIndexSQL(table: DrizzleTable, tableName: string): string[] {
  logger.debug(`生成表 '${tableName}' 的索引 SQL`);

  const tableSymbol = Symbol.for('drizzle:Table');
  const tableConfig = table[tableSymbol];

  if (!tableConfig) {
    return [];
  }

  const indexes = tableConfig.indexes || [];
  const indexStatements: string[] = [];

  for (const idx of indexes) {
    const indexName = idx.name;
    const columns = idx.columns.map((c: any) => c.name).join(', ');
    const isUnique = idx.unique ? 'UNIQUE ' : '';

    const sql = `CREATE ${isUnique}INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columns});`;
    indexStatements.push(sql);
  }

  logger.debug(`生成了 ${indexStatements.length} 个索引`);

  return indexStatements;
}

/**
 * 检查表是否存在
 *
 * @param db - 数据库连接
 * @param tableName - 表名
 * @returns 表是否存在
 */
export async function tableExists(db: any, tableName: string): Promise<boolean> {
  try {
    const result = await db.$client.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      args: [tableName],
    });

    return result.rows && result.rows.length > 0;
  } catch (error) {
    logger.error(`检查表 '${tableName}' 是否存在时出错`, error);
    return false;
  }
}

/**
 * 执行 CREATE TABLE SQL
 *
 * @param db - 数据库连接
 * @param sql - CREATE TABLE SQL
 * @returns 是否成功
 */
export async function executeCreateTable(db: any, sql: string): Promise<boolean> {
  try {
    logger.debug(`执行 SQL: ${sql}`);

    await db.$client.execute({ sql, args: [] });

    logger.log(`成功创建表`);
    return true;
  } catch (error) {
    // 忽略 "table already exists" 错误
    if (error instanceof Error && error.message.includes('already exists')) {
      logger.debug(`表已存在，跳过创建`);
      return true;
    }

    logger.error(`执行 CREATE TABLE 失败`, error);
    return false;
  }
}

/**
 * 自动迁移插件表
 *
 * 从 Drizzle 表定义自动生成并执行 CREATE TABLE SQL
 *
 * @param db - 数据库连接
 * @param table - Drizzle 表对象
 * @param tableName - 表名
 * @returns 是否成功
 */
export async function autoMigrateTable(
  db: any,
  table: DrizzleTable,
  tableName: string,
): Promise<boolean> {
  logger.log(`开始自动迁移表: ${tableName}`);

  try {
    // 1. 检查表是否已存在
    const exists = await tableExists(db, tableName);
    if (exists) {
      logger.debug(`表 '${tableName}' 已存在，跳过迁移`);
      return true;
    }

    // 2. 生成 CREATE TABLE SQL
    const createTableSQL = generateCreateTableSQL(table, tableName);

    // 3. 执行 CREATE TABLE
    const tableCreated = await executeCreateTable(db, createTableSQL);
    if (!tableCreated) {
      logger.error(`创建表 '${tableName}' 失败`);
      return false;
    }

    // 4. 生成并执行 CREATE INDEX SQL
    const createIndexSQLs = generateCreateIndexSQL(table, tableName);
    for (const indexSQL of createIndexSQLs) {
      try {
        await db.$client.execute({ sql: indexSQL, args: [] });
        logger.debug(`成功创建索引`);
      } catch (_error) {
        // 索引可能已存在，忽略错误
        logger.debug(`索引可能已存在，跳过创建`);
      }
    }

    logger.log(`表 '${tableName}' 迁移完成`);
    return true;
  } catch (error) {
    logger.error(`自动迁移表 '${tableName}' 失败`, error);
    return false;
  }
}
