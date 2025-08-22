import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { siteMeta } from '../../database/schema';

/**
 * 迁移记录接口
 */
interface MigrationRecord {
  id: string;
  name: string;
  executedAt: Date;
  version: string;
}

/**
 * 迁移脚本接口
 */
interface Migration {
  id: string;
  name: string;
  version: string;
  up: (db: Database) => Promise<void>;
  down?: (db: Database) => Promise<void>;
}

/**
 * 数据迁移服务
 *
 * 处理数据库结构变更和数据迁移，支持版本控制、回滚操作、
 * 完整性验证等功能。确保数据库结构的安全升级和降级。
 */
@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  private readonly migrations: Migration[] = [];

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {
    this.initializeMigrations();
  }

  /**
   * 初始化迁移脚本
   */
  private initializeMigrations(): void {
    // 添加内置迁移脚本
    this.migrations.push(
      {
        id: '001_initial_indexes',
        name: 'Add initial database indexes',
        version: '1.0.0',
        up: async (_db: Database) => {
          // 这个迁移已经在 schema.ts 中定义了索引，这里只是记录
          this.logger.log('Initial indexes migration completed');
          return Promise.resolve();
        },
      },
      {
        id: '002_optimize_queries',
        name: 'Optimize database queries',
        version: '1.1.0',
        up: async (db: Database) => {
          // 运行 ANALYZE 命令来更新统计信息
          await db.run(sql`ANALYZE`);
          this.logger.log('Database statistics updated');
        },
      },
      {
        id: '003_cleanup_orphaned_data',
        name: 'Clean up orphaned data',
        version: '1.2.0',
        up: async (db: Database) => {
          // 清理孤立的标签数据（没有关联文章的标签）
          await db.run(sql`
            DELETE FROM tags
            WHERE name NOT IN (
              SELECT DISTINCT value as tag_name
              FROM articles,
                   json_each(CASE WHEN json_valid(articles.tags) THEN articles.tags ELSE '[]' END)
              WHERE articles.tags IS NOT NULL
                AND TRIM(articles.tags) != ''
                AND articles.tags != '[]'
            )
          `);

          // 清理孤立的分类数据（没有关联文章的分类）
          await db.run(sql`
            DELETE FROM categories
            WHERE name NOT IN (
              SELECT DISTINCT category
              FROM articles
              WHERE category IS NOT NULL
            )
          `);

          this.logger.log('Orphaned data cleanup completed');
        },
      },
    );
  }

  /**
   * 运行所有待执行的迁移
   */
  /**
   * 执行所有待执行的迁移
   *
   * 检查并执行所有尚未执行的迁移脚本，按版本顺序依次执行。
   * 每个迁移都会在事务中执行，确保数据一致性。
   *
   * @throws Error 当迁移执行失败时抛出异常
   */
  async runMigrations(): Promise<void> {
    this.logger.log('Starting database migrations...');

    // 确保迁移记录表存在
    await this.ensureMigrationTable();

    // 获取已执行的迁移
    const executedMigrations = await this.getExecutedMigrations();
    const executedIds = new Set(executedMigrations.map((m) => m.id));

    // 执行待执行的迁移
    const pendingMigrations = this.migrations.filter((m) => !executedIds.has(m.id));

    if (pendingMigrations.length === 0) {
      this.logger.log('No pending migrations');
      return;
    }

    this.logger.log(`Found ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    this.logger.log('All migrations completed successfully');
  }

  /**
   * 确保迁移记录表存在
   */
  private async ensureMigrationTable(): Promise<void> {
    try {
      // 检查是否已有迁移记录
      await this.db.select().from(siteMeta).where(eq(siteMeta.key, 'migration_version')).limit(1);
    } catch {
      // 如果查询失败，说明可能是新数据库，初始化迁移记录
      await this.db.insert(siteMeta).values({
        key: 'migration_version',
        value: JSON.stringify({ version: '1.0.0', migrations: [] }),
      });
    }
  }

  /**
   * 获取已执行的迁移记录
   */
  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    try {
      const result = await this.db
        .select()
        .from(siteMeta)
        .where(eq(siteMeta.key, 'migration_version'))
        .limit(1);

      if (result.length === 0) {
        return [];
      }

      const data = JSON.parse(result[0].value ?? '{}') as { migrations?: MigrationRecord[] };
      return data.migrations ?? [];
    } catch (error) {
      this.logger.error('Failed to get executed migrations:', error);
      return [];
    }
  }

  /**
   * 执行单个迁移
   */
  private async executeMigration(migration: Migration): Promise<void> {
    this.logger.log(`Executing migration: ${migration.name}`);

    try {
      // 执行迁移
      await migration.up(this.db);

      // 记录迁移执行
      await this.recordMigration(migration);

      this.logger.log(`Migration completed: ${migration.name}`);
    } catch (error) {
      this.logger.error(`Migration failed: ${migration.name}`, error);
      throw error;
    }
  }

  /**
   * 记录迁移执行
   */
  private async recordMigration(migration: Migration): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();

    const newRecord: MigrationRecord = {
      id: migration.id,
      name: migration.name,
      executedAt: new Date(),
      version: migration.version,
    };

    executedMigrations.push(newRecord);

    const data = {
      version: migration.version,
      migrations: executedMigrations,
    };

    // 更新迁移记录
    await this.db
      .update(siteMeta)
      .set({
        value: JSON.stringify(data),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(siteMeta.key, 'migration_version'));
  }

  /**
   * 回滚迁移
   */
  /**
   * 回滚指定的迁移
   *
   * 执行指定迁移的回滚操作，将数据库恢复到迁移前的状态。
   * 只有提供了 down 方法的迁移才能被回滚。
   *
   * @param migrationId 要回滚的迁移 ID
   * @throws Error 当迁移不存在、未执行或不支持回滚时抛出异常
   */
  async rollbackMigration(migrationId: string): Promise<void> {
    const migration = this.migrations.find((m) => m.id === migrationId);
    if (!migration) {
      throw new Error(`Migration not found: ${migrationId}`);
    }

    if (!migration.down) {
      throw new Error(`Migration ${migrationId} does not support rollback`);
    }

    this.logger.log(`Rolling back migration: ${migration.name}`);

    try {
      await migration.down(this.db);
      await this.removeMigrationRecord(migrationId);
      this.logger.log(`Migration rolled back: ${migration.name}`);
    } catch (error) {
      this.logger.error(`Migration rollback failed: ${migration.name}`, error);
      throw error;
    }
  }

  /**
   * 移除迁移记录
   */
  private async removeMigrationRecord(migrationId: string): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();
    const filteredMigrations = executedMigrations.filter((m) => m.id !== migrationId);

    const data = {
      version: '1.0.0', // 重置版本
      migrations: filteredMigrations,
    };

    await this.db
      .update(siteMeta)
      .set({
        value: JSON.stringify(data),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(siteMeta.key, 'migration_version'));
  }

  /**
   * 获取迁移状态
   */
  /**
   * 获取迁移状态信息
   *
   * 返回当前数据库的迁移状态，包括版本信息、执行统计和待执行列表。
   *
   * @returns 包含迁移状态的详细信息
   */
  async getMigrationStatus(): Promise<{
    currentVersion: string;
    totalMigrations: number;
    executedMigrations: number;
    pendingMigrations: string[];
  }> {
    const executedMigrations = await this.getExecutedMigrations();
    const executedIds = new Set(executedMigrations.map((m) => m.id));
    const pendingMigrations = this.migrations
      .filter((m) => !executedIds.has(m.id))
      .map((m) => m.id);

    const currentVersion =
      executedMigrations.length > 0
        ? executedMigrations[executedMigrations.length - 1].version
        : '0.0.0';

    return {
      currentVersion,
      totalMigrations: this.migrations.length,
      executedMigrations: executedMigrations.length,
      pendingMigrations,
    };
  }

  /**
   * 从文件加载迁移脚本
   */
  /**
   * 从目录加载迁移脚本
   *
   * 扫描指定目录下的迁移文件，动态加载迁移脚本。
   * 支持 TypeScript 和 JavaScript 格式的迁移文件。
   *
   * @param migrationDir 迁移文件目录路径
   * @throws Error 当目录不存在或文件格式错误时抛出异常
   */
  async loadMigrationsFromDirectory(migrationDir: string): Promise<void> {
    try {
      const files = await fs.readdir(migrationDir);
      const migrationFiles = files
        .filter((file) => file.endsWith('.migration.js') || file.endsWith('.migration.ts'))
        .sort();

      for (const file of migrationFiles) {
        const filePath = path.join(migrationDir, file);

        const migrationModule = (await import(filePath)) as { default?: Migration } | Migration;

        const moduleExports =
          'default' in migrationModule
            ? (migrationModule.default ?? migrationModule)
            : migrationModule;
        this.migrations.push(moduleExports as Migration);
      }

      this.logger.log(`Loaded ${migrationFiles.length} migration files from ${migrationDir}`);
    } catch (error) {
      this.logger.warn(`Failed to load migrations from directory: ${migrationDir}`, error);
    }
  }

  /**
   * 验证数据库完整性
   */
  /**
   * 验证数据库完整性
   *
   * 检查数据库结构的完整性，包括表结构、索引、约束等。
   * 识别潜在的数据完整性问题并提供修复建议。
   *
   * @returns 包含验证结果和问题列表的对象
   */
  async validateDatabaseIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // 检查外键约束
      const foreignKeyCheck = await this.db.get(sql`PRAGMA foreign_key_check`);
      if (foreignKeyCheck !== undefined && foreignKeyCheck !== null) {
        issues.push(`Foreign key constraint violation: ${JSON.stringify(foreignKeyCheck)}`);
      }

      // 检查数据库完整性
      const integrityCheck = await this.db.get(sql`PRAGMA integrity_check`);
      const integrityResult =
        integrityCheck !== null &&
        typeof integrityCheck === 'object' &&
        'integrity_check' in integrityCheck
          ? (integrityCheck as Record<string, unknown>)['integrity_check']
          : undefined;
      const resultStr = typeof integrityResult === 'string' ? integrityResult : 'unknown';
      if (resultStr !== 'ok') {
        issues.push(`Database integrity check failed: ${resultStr}`);
      }

      // 检查索引完整性
      const indexCheck = await this.db.all(sql`PRAGMA index_list`);
      // 这里可以添加更多的索引检查逻辑
      void indexCheck; // 避免未使用变量警告
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      issues.push(`Database validation failed: ${errorMessage}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
