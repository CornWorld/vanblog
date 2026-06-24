import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import * as zlib from 'zlib';

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import {
  users,
  articles,
  categories,
  tags,
  drafts,
  draftVersions,
  staticFiles,
  siteMeta,
  loginLogs,
  customPages,
  analytics,
  permissionNodes,
  permissionGroups,
  pluginData,
  webhooks,
  webhookLogs,
} from '@vanblog/shared/drizzle';
import { z } from 'zod';

import { ConfigService } from '../../config/config.service';
import { LoggerService } from '../../core/logger/logger.service';
import { DATABASE_CONNECTION, type Database } from '../../database';

import {
  CreateBackupSchema,
  RestoreBackupSchema,
  GetBackupsSchema,
  BackupInfoSchema,
  BackupListSchema,
  RestoreProgressSchema,
} from './dto/backup.dto';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface BackupMetadata {
  id: string;
  name: string;
  description?: string;
  version: string;
  createdAt: string;
  hasPassword: boolean;
  includeMedia: boolean;
  includeAnalytics: boolean;
  includeLogs: boolean;
  tables: Record<string, number>;
}

interface RestoreTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentTable?: string;
  message?: string;
  error?: string;
}

@Injectable()
export class BackupService {
  private readonly backupDir = path.join(process.cwd(), 'data', 'backups');
  private readonly restoreTasks = new Map<string, RestoreTask>();

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    void this.ensureBackupDir();
  }

  private async ensureBackupDir(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      this.logger.error(
        'Failed to create backup directory',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async createBackup(
    dto: z.infer<typeof CreateBackupSchema>,
  ): Promise<z.infer<typeof BackupInfoSchema>> {
    const backupId = crypto.randomUUID();
    const timestamp = dayjs().format().replace(/[:.]/g, '-');
    const backupName = dto.name ?? `backup-${timestamp}`;
    const filename = `${backupName}-${backupId}.vbak`;
    const filepath = path.join(this.backupDir, filename);

    try {
      this.logger.log(`Creating backup: ${backupName}`);

      // 收集数据
      const data = await this.collectData(dto);
      const tableCounts = this.getTableCounts(data);

      // 创建备份元数据
      const metadata: BackupMetadata = {
        id: backupId,
        name: backupName,
        description: dto.description,
        version: '1.0.0',
        createdAt: dayjs().format(),
        hasPassword: !!dto.password,
        includeMedia: dto.includeMedia,
        includeAnalytics: dto.includeAnalytics,
        includeLogs: dto.includeLogs,
        tables: tableCounts,
      };

      // 创建备份内容
      const backup = {
        metadata,
        data,
      };

      let content = JSON.stringify(backup, null, 2);

      // 加密（如果需要）
      if (dto.password) {
        content = this.encrypt(content, dto.password);
      }

      // 压缩并保存
      const compressed = await gzip(Buffer.from(content));
      await fs.writeFile(filepath, compressed);

      // 获取文件信息
      const stats = await fs.stat(filepath);

      this.logger.log(`Backup created successfully: ${filename} (${String(stats.size)} bytes)`);

      return {
        id: backupId,
        name: backupName,
        description: dto.description,
        filename,
        size: stats.size,
        hasPassword: !!dto.password,
        includeMedia: dto.includeMedia,
        includeAnalytics: dto.includeAnalytics,
        includeLogs: dto.includeLogs,
        createdAt: metadata.createdAt,
        tables: metadata.tables,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to create backup: ${errorMessage}`,
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException('Failed to create backup');
    }
  }

  async getBackups(
    dto: z.infer<typeof GetBackupsSchema>,
  ): Promise<z.infer<typeof BackupListSchema>> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter((file) => file.endsWith('.vbak'));

      const backups: z.infer<typeof BackupInfoSchema>[] = [];

      for (const file of backupFiles) {
        try {
          const filepath = path.join(this.backupDir, file);
          const stats = await fs.stat(filepath);
          const metadata = await this.getBackupMetadata(filepath);

          if (!dto.search || metadata.name.toLowerCase().includes(dto.search.toLowerCase())) {
            backups.push({
              id: metadata.id,
              name: metadata.name,
              description: metadata.description,
              filename: file,
              size: stats.size,
              hasPassword: metadata.hasPassword,
              includeMedia: metadata.includeMedia,
              includeAnalytics: metadata.includeAnalytics,
              includeLogs: metadata.includeLogs,
              createdAt: metadata.createdAt,
              tables: metadata.tables,
            });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to read backup metadata for ${file}: ${errorMessage}`);

          // 如果是加密备份，创建一个默认的备份项
          if (errorMessage.includes('encrypted') || errorMessage.includes('Cannot read metadata')) {
            const filepath = path.join(this.backupDir, file);
            const stats = await fs.stat(filepath);

            backups.push({
              id: file.replace('.vbak', ''),
              name: 'Encrypted Backup',
              description: 'This backup is encrypted and requires a password to view details',
              filename: file,
              size: stats.size,
              hasPassword: true,
              includeMedia: false,
              includeAnalytics: false,
              includeLogs: false,
              createdAt: dayjs(stats.mtime).format(),
              tables: {},
            });
          }
        }
      }

      // 按创建时间倒序排列
      backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // 分页
      const start = (dto.page - 1) * dto.limit;
      const end = start + dto.limit;
      const paginatedBackups = backups.slice(start, end);

      return {
        backups: paginatedBackups,
        total: backups.length,
        page: dto.page,
        limit: dto.limit,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get backups: ${errorMessage}`, errorMessage);
      throw new InternalServerErrorException('Failed to get backups');
    }
  }

  async deleteBackup(filename: string): Promise<void> {
    const filepath = path.join(this.backupDir, filename);

    try {
      await fs.access(filepath);
      await fs.unlink(filepath);
      this.logger.log(`Backup deleted: ${filename}`);
    } catch (error: unknown) {
      if (
        error != null &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        throw new NotFoundException('Backup file not found');
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete backup: ${errorMessage}`, errorMessage);
      throw new InternalServerErrorException('Failed to delete backup');
    }
  }

  async restoreBackup(
    filename: string,
    dto: z.infer<typeof RestoreBackupSchema>,
  ): Promise<{ taskId: string }> {
    const filepath = path.join(this.backupDir, filename);
    const taskId = crypto.randomUUID();

    try {
      await fs.access(filepath);
    } catch (_error) {
      throw new NotFoundException('Backup file not found');
    }

    // 创建恢复任务
    const task: RestoreTask = {
      id: taskId,
      status: 'pending',
      progress: 0,
    };
    this.restoreTasks.set(taskId, task);

    // 异步执行恢复
    this.performRestore(filepath, dto, task).catch((error: unknown) => {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Restore task ${taskId} failed:`,
        error instanceof Error ? error.message : String(error),
      );
    });

    return { taskId };
  }

  getRestoreProgress(taskId: string): z.infer<typeof RestoreProgressSchema> {
    const task = this.restoreTasks.get(taskId);
    if (!task) {
      throw new NotFoundException('Restore task not found');
    }

    return {
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      currentTable: task.currentTable,
      message: task.message,
      error: task.error,
    };
  }

  private async collectData(
    dto: z.infer<typeof CreateBackupSchema>,
  ): Promise<Record<string, unknown[]>> {
    const data: Record<string, unknown[]> = {};

    // 用户数据
    data.users = await this.db.select().from(users);

    // 文章数据
    data.articles = await this.db.select().from(articles);
    data.categories = await this.db.select().from(categories);
    data.tags = await this.db.select().from(tags);
    data.drafts = await this.db.select().from(drafts);
    data.draftVersions = await this.db.select().from(draftVersions);
    data.customPages = await this.db.select().from(customPages);

    // 媒体文件（如果包含）
    if (dto.includeMedia) {
      data.staticFiles = await this.db.select().from(staticFiles);
    }

    // 系统数据
    data.siteMeta = await this.db.select().from(siteMeta);
    data.permissionNodes = await this.db.select().from(permissionNodes);
    data.permissionGroups = await this.db.select().from(permissionGroups);
    data.pluginData = await this.db.select().from(pluginData);
    data.webhooks = await this.db.select().from(webhooks);

    // 分析数据（如果包含）
    if (dto.includeAnalytics) {
      data.analytics = await this.db.select().from(analytics);
    }

    // 日志数据（如果包含）
    if (dto.includeLogs) {
      data.loginLogs = await this.db.select().from(loginLogs);
      data.webhookLogs = await this.db.select().from(webhookLogs);
    }

    return data;
  }

  private getTableCounts(data: Record<string, unknown[]>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [tableName, records] of Object.entries(data)) {
      counts[tableName] = records.length;
    }
    return counts;
  }

  private async getBackupMetadata(filepath: string): Promise<BackupMetadata> {
    try {
      const compressed = await fs.readFile(filepath);
      const decompressed = await gunzip(compressed);
      const content = decompressed.toString();

      try {
        const backup = JSON.parse(content) as { metadata: BackupMetadata };

        return backup.metadata;
      } catch {
        // 可能是加密的备份，无法读取元数据
        throw new Error('Cannot read metadata from encrypted backup');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read backup metadata: ${errorMessage}`);
    }
  }

  private async performRestore(
    filepath: string,
    dto: z.infer<typeof RestoreBackupSchema>,
    task: RestoreTask,
  ): Promise<void> {
    task.status = 'running';
    task.progress = 0;
    task.message = 'Reading backup file...';

    try {
      // 读取和解压备份文件
      const compressed = await fs.readFile(filepath);
      const decompressed = await gunzip(compressed);
      let content = decompressed.toString();

      task.progress = 10;
      task.message = 'Parsing backup data...';

      // 解密（如果需要）
      try {
        const backup = JSON.parse(content);
        if (backup.metadata && !backup.metadata.hasPassword) {
          // 未加密的备份
        } else {
          throw new Error('Encrypted backup detected');
        }
      } catch {
        // 尝试解密
        if (!dto.password) {
          throw new BadRequestException('Password required for encrypted backup');
        }
        content = this.decrypt(content, dto.password);
      }

      const backup = JSON.parse(content) as {
        metadata: BackupMetadata;
        data: Record<string, unknown[]>;
      };

      const { metadata, data } = backup;

      task.progress = 20;
      task.message = 'Validating backup data...';

      // 验证备份版本兼容性

      if (!metadata.version) {
        throw new Error('Invalid backup format');
      }

      // 开始恢复数据

      const tables = Object.keys(data);
      const totalTables = tables.length;
      let processedTables = 0;

      for (const tableName of tables) {
        task.currentTable = tableName;
        task.message = `Restoring ${tableName}...`;

        // 根据选项决定是否恢复某些表
        if (!dto.restoreMedia && tableName === 'staticFiles') continue;
        if (!dto.restoreAnalytics && tableName === 'analytics') continue;
        if (!dto.restoreLogs && tableName === 'loginLogs') continue;

        await this.restoreTable(tableName, data[tableName], dto.overwriteExisting);

        processedTables++;
        task.progress = 20 + Math.floor((processedTables / totalTables) * 70);
      }

      task.progress = 95;
      task.message = 'Finalizing restore...';

      // 清理和优化
      await this.optimizeDatabase();

      task.progress = 100;
      task.status = 'completed';
      task.message = 'Restore completed successfully';
      task.currentTable = undefined;

      this.logger.log(`Restore task ${task.id} completed successfully`);
    } catch (error: unknown) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Restore task ${task.id} failed:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private async restoreTable(
    tableName: string,
    records: unknown[],
    overwrite: boolean,
  ): Promise<void> {
    // 获取对应的表定义
    const tableMap: Record<string, unknown> = {
      users,
      articles,
      categories,
      tags,
      drafts,
      draftVersions,
      staticFiles,
      siteMeta,
      loginLogs,
      customPages,
      analytics,
      permissionNodes,
      permissionGroups,
      pluginData,

      webhooks,
      webhookLogs,
    };

    type TableType =
      | typeof users
      | typeof articles
      | typeof categories
      | typeof tags
      | typeof drafts
      | typeof draftVersions
      | typeof staticFiles
      | typeof siteMeta
      | typeof loginLogs
      | typeof customPages
      | typeof analytics
      | typeof permissionNodes
      | typeof permissionGroups
      | typeof pluginData
      | typeof webhooks
      | typeof webhookLogs;
    const table = tableMap[tableName] as TableType | undefined;

    if (!table) {
      this.logger.warn(`Unknown table: ${tableName}`);
      return;
    }

    if (overwrite) {
      // 清空现有数据
      await this.db.delete(table);
    }

    // 批量插入数据
    if (records.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        // Type-safe batch: infer type from records array
        const batch = records.slice(i, i + batchSize) as Record<string, unknown>[];
        try {
          await this.db.insert(table).values(batch).onConflictDoNothing();
        } catch (error: unknown) {
          this.logger.warn(
            `Failed to insert batch for ${tableName}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }
  }

  private async optimizeDatabase(): Promise<void> {
    try {
      // SQLite 优化命令
      await (this.db as unknown as { run: (sql: string) => Promise<unknown> }).run('VACUUM');
      await (this.db as unknown as { run: (sql: string) => Promise<unknown> }).run('ANALYZE');
    } catch (error: unknown) {
      this.logger.warn(
        'Failed to optimize database:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private encrypt(data: string, password: string): string {
    const algorithm = 'aes-256-cbc';
    // 使用配置的 JWT_SECRET 作为 salt，确保加密密钥的强度
    const secret = this.configService.get<string>('JWT_SECRET', 'default-backup-salt-change-this');
    const key = crypto.scryptSync(password, secret, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
    });
  }

  private decrypt(encryptedData: string, password: string): string {
    const algorithm = 'aes-256-cbc';
    // 使用配置的 JWT_SECRET 作为 salt，确保加密密钥的强度
    const secret = this.configService.get<string>('JWT_SECRET', 'default-backup-salt-change-this');
    const key = crypto.scryptSync(password, secret, 32);

    const parsed = JSON.parse(encryptedData) as {
      encrypted: string;
      iv: string;
    };
    const { encrypted, iv } = parsed;

    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Additional methods for ts-rest contract compatibility

  async importBackup(file: Express.Multer.File): Promise<void> {
    const filepath = path.join(this.backupDir, file.originalname);
    await fs.writeFile(filepath, file.buffer);

    this.logger.log(`Backup file imported: ${file.originalname}`);
  }

  async exportBackup(): Promise<Buffer> {
    // Create a backup with default settings
    const dto: z.infer<typeof CreateBackupSchema> = {
      name: `export-${dayjs().format().replace(/[:.]/g, '-')}`,
      includeMedia: false,
      includeAnalytics: false,
      includeLogs: false,
    };

    const backupInfo = await this.createBackup(dto);
    const filepath = path.join(this.backupDir, backupInfo.filename);
    const compressed = await fs.readFile(filepath);

    // Clean up the temporary backup file
    await fs.unlink(filepath);

    return compressed;
  }

  async restoreFromBackup(body: unknown): Promise<void> {
    const dto = RestoreBackupSchema.parse(body);
    // For restore from contract, we expect body to contain filename or backup data
    if ('filename' in dto && typeof dto.filename === 'string') {
      await this.restoreBackup(dto.filename, dto);
    } else {
      throw new BadRequestException('Invalid restore request');
    }
  }
}
