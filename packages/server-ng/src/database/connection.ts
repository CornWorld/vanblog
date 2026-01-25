import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

import type { DatabaseConfig } from '../config/database.config';
import type { LoggerService } from '../core/logger/logger.service';

/**
 * 数据库连接类型定义
 * 基于 LibSQL（SQLite 的现代分支），支持本地和远程连接
 */
export type Database = LibSQLDatabase<Record<string, unknown>>;

/**
 * 创建数据库连接
 *
 * 支持三种数据库驱动：
 * - local: 本地 SQLite 文件数据库
 * - turso: Turso 云数据库（需要 authToken）
 * - d1: Cloudflare D1 数据库（需要 accountId、databaseId、d1Token）
 *
 * @param config - 数据库配置对象
 * @param logger - 日志服务实例
 * @returns 返回 Drizzle ORM 数据库实例
 */
export async function createDatabaseConnection(
  config: DatabaseConfig,
  logger: LoggerService,
): Promise<Database> {
  logger.log(`Initializing database with driver: ${config.driver}`, 'Database');

  // 根据不同的数据库驱动配置客户端连接参数
  let clientConfig;

  switch (config.driver) {
    case 'turso':
      // Turso 云数据库配置
      clientConfig = {
        url: config.url,
        authToken:
          config.authToken != null && config.authToken !== '' ? config.authToken : undefined,
      };
      break;
    case 'd1':
      // Cloudflare D1 数据库配置
      // 在开发环境中会回退到本地 SQLite
      clientConfig = {
        url: config.url !== '' ? config.url : 'file:./data/vanblog.db',
      };
      break;
    case 'local':
    default:
      // 本地 SQLite 数据库配置
      clientConfig = {
        url: config.url !== '' ? config.url : 'file:./data/vanblog.db',
      };
  }

  // 创建 LibSQL 客户端并初始化 Drizzle ORM
  const client = createClient(clientConfig);
  const db = drizzle(client);

  // 启用 SQLite 外键约束（确保数据库引用完整性）
  db.run(sql`PRAGMA foreign_keys = ON`)
    .then(() => {
      logger.log('Foreign key constraints enabled', 'Database');
    })
    .catch((error: unknown) => {
      logger.error('Failed to enable foreign key constraints', String(error), 'Database');
    });

  logger.log('Database connection established', 'Database');

  // 测试环境自动迁移配置
  // 注意：测试环境优先使用 test/setup.ts 中的 schema push，只有在设置 DB_AUTO_MIGRATE=true 时才运行迁移
  if (process.env.NODE_ENV === 'test' && process.env.DB_AUTO_MIGRATE === 'true') {
    try {
      const migrationsPath = `${process.cwd()}/drizzle/migrations`;
      logger.log(`Running migrations from: ${migrationsPath}`, 'Database');
      await migrate(db, { migrationsFolder: migrationsPath });
      logger.log('Test database migrations completed', 'Database');
    } catch (error: unknown) {
      logger.error('Failed to run test database migrations', String(error), 'Database');
      throw error;
    }
  }

  return db;
}
