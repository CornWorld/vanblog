import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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
 * 确保数据库 Schema 已创建（仅开发环境）
 *
 * 检查数据库文件是否存在，如果不存在或表结构不完整，则运行 db:push
 */
function ensureDatabaseSchema(logger: LoggerService, config: DatabaseConfig): void {
  try {
    // 解析数据库文件路径
    const dbPath =
      config.url !== '' && config.url.startsWith('file:')
        ? config.url.substring(5) // 移除 "file:" 前缀
        : './data/vanblog.db';

    const dbAbsolutePath = path.resolve(process.cwd(), dbPath);

    // 检查数据库文件是否存在
    const dbExists = fs.existsSync(dbAbsolutePath);

    // 检查关键表是否存在（通过尝试查询 site_meta 表）
    let schemaNeedsPush = false;
    if (dbExists) {
      try {
        // 简单的表存在性检查 - 尝试读取表信息
        const tableCheckResult = execSync(`sqlite3 "${dbAbsolutePath}" ".tables"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        schemaNeedsPush = !tableCheckResult.includes('site_meta');
      } catch {
        // 如果查询失败，可能数据库损坏，需要重新创建
        schemaNeedsPush = true;
      }
    } else {
      schemaNeedsPush = true;
    }

    if (schemaNeedsPush) {
      logger.log('Database schema not found or incomplete, running db:push...', 'Database');
      try {
        execSync('pnpm --filter @vanblog/server-ng db:push', {
          stdio: 'inherit',
          cwd: process.cwd(),
        });
        logger.log('Database schema pushed successfully', 'Database');
      } catch (err) {
        logger.error('Failed to push database schema', String(err), 'Database');
        throw err;
      }
    }
  } catch {
    // 如果自动推送失败，记录错误但不阻止启动
    // 允许用户手动运行 db:push
    logger.warn(
      'Failed to auto-create database schema. Please run "pnpm db:push" manually.',
      'Database',
    );
  }
}

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

  // 开发环境自动推送 Schema（如果数据库文件不存在或表结构不匹配）
  // 注意：只在 local 驱动且开发环境启用
  if (process.env.NODE_ENV === 'development' && config.driver === 'local') {
    ensureDatabaseSchema(logger, config);
  }

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
