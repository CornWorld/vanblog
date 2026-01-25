import { Test, type TestingModule } from '@nestjs/testing';
import { siteMeta } from '@vanblog/shared/drizzle';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { DATABASE_CONNECTION, type Database } from '../../database';

import { MigrationService } from './migration.service';

describe('MigrationService', () => {
  let service: MigrationService;
  let mockDb: Database;

  const mockMigrationRecord = {
    key: 'migration_version',
    value: {
      version: '1.0.0',
      migrations: [
        {
          id: '001_initial_indexes',
          name: 'Add initial database indexes',
          executedAt: new Date('2024-01-01'),
          version: '1.0.0',
        },
      ],
    },
  };

  beforeEach(async () => {
    // 创建数据库 mock
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMigrationRecord]),
    };

    const mockInsertChain = {
      values: vi.fn().mockResolvedValue(undefined),
    };

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      select: vi.fn().mockReturnValue(mockSelectChain),
      insert: vi.fn().mockReturnValue(mockInsertChain),
      update: vi.fn().mockReturnValue(mockUpdateChain),
      run: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ integrity_check: 'ok' }),
      all: vi.fn().mockResolvedValue([]),
    } as unknown as Database;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<MigrationService>(MigrationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runMigrations', () => {
    it('should run pending migrations successfully', async () => {
      // Mock 没有已执行的迁移 - 模拟新数据库
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('No migration record')),
      };
      mockDb.select = vi.fn().mockReturnValue(mockSelectChain);

      await service.runMigrations();

      // 验证初始化迁移记录表
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should skip migrations when no pending migrations', async () => {
      // Mock 所有迁移都已执行
      const allMigrationsExecuted = {
        key: 'migration_version',
        value: {
          version: '1.2.0',
          migrations: [
            {
              id: '001_initial_indexes',
              name: 'Add initial database indexes',
              executedAt: new Date('2024-01-01'),
              version: '1.0.0',
            },
            {
              id: '002_optimize_queries',
              name: 'Optimize database queries',
              executedAt: new Date('2024-01-02'),
              version: '1.1.0',
            },
            {
              id: '003_cleanup_orphaned_data',
              name: 'Clean up orphaned data',
              executedAt: new Date('2024-01-03'),
              version: '1.2.0',
            },
          ],
        },
      };

      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([allMigrationsExecuted]),
      };
      mockDb.select = vi.fn().mockReturnValue(mockSelectChain);

      await service.runMigrations();

      // 验证没有执行新的迁移
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('should handle migration execution failure', async () => {
      // Mock 没有已执行的迁移 - 模拟新数据库
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('No migration record')),
      };
      mockDb.select = vi.fn().mockReturnValue(mockSelectChain);
      mockDb.run = vi.fn().mockRejectedValue(new Error('Migration failed'));

      await expect(service.runMigrations()).rejects.toThrow('Migration failed');
    });
  });

  describe('getMigrationStatus', () => {
    it('should return correct migration status', async () => {
      const status = await service.getMigrationStatus();

      expect(status).toHaveProperty('currentVersion');
      expect(status).toHaveProperty('totalMigrations');
      expect(status).toHaveProperty('executedMigrations');
      expect(status).toHaveProperty('pendingMigrations');
      expect(typeof status.totalMigrations).toBe('number');
      expect(Array.isArray(status.pendingMigrations)).toBe(true);
    });

    it('should return 0.0.0 as current version when no migrations executed', async () => {
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDb.select = vi.fn().mockReturnValue(mockSelectChain);

      const status = await service.getMigrationStatus();

      expect(status.currentVersion).toBe('0.0.0');
      expect(status.executedMigrations).toBe(0);
    });
  });

  describe('rollbackMigration', () => {
    it('should throw error for non-existent migration', async () => {
      await expect(service.rollbackMigration('non_existent_migration')).rejects.toThrow(
        'Migration not found: non_existent_migration',
      );
    });

    it('should throw error for migration without rollback support', async () => {
      // 内置迁移没有 down 方法
      await expect(service.rollbackMigration('001_initial_indexes')).rejects.toThrow(
        'Migration 001_initial_indexes does not support rollback',
      );
    });
  });

  describe('validateDatabaseIntegrity', () => {
    it('should return valid result when database is healthy', async () => {
      mockDb.get = vi
        .fn()
        .mockResolvedValueOnce(null) // foreign_key_check
        .mockResolvedValueOnce({ integrity_check: 'ok' }); // integrity_check
      mockDb.all = vi.fn().mockResolvedValue([]);

      const result = await service.validateDatabaseIntegrity();

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should return invalid result when foreign key constraint violated', async () => {
      mockDb.get = vi
        .fn()
        .mockResolvedValueOnce({ table: 'test', rowid: 1 }) // foreign_key_check
        .mockResolvedValueOnce({ integrity_check: 'ok' }); // integrity_check
      mockDb.all = vi.fn().mockResolvedValue([]);

      const result = await service.validateDatabaseIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('Foreign key constraint violation');
    });

    it('should return invalid result when integrity check fails', async () => {
      mockDb.get = vi
        .fn()
        .mockResolvedValueOnce(null) // foreign_key_check
        .mockResolvedValueOnce({ integrity_check: 'corruption detected' }); // integrity_check
      mockDb.all = vi.fn().mockResolvedValue([]);

      const result = await service.validateDatabaseIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('Database integrity check failed');
    });

    it('should handle database validation errors', async () => {
      mockDb.get = vi.fn().mockRejectedValue(new Error('Database error'));

      const result = await service.validateDatabaseIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('Database validation failed: Database error');
    });
  });

  describe('loadMigrationsFromDirectory', () => {
    it('should handle directory loading gracefully when directory does not exist', async () => {
      // 这个方法会捕获错误并记录警告，不会抛出异常
      await expect(
        service.loadMigrationsFromDirectory('/non/existent/path'),
      ).resolves.not.toThrow();
    });
  });

  describe('ensureMigrationTable', () => {
    it('should create migration record when table is empty', async () => {
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('Table not found')),
      };
      mockDb.select = vi.fn().mockReturnValue(mockSelectChain);

      await service.runMigrations();

      expect(mockDb.insert).toHaveBeenCalledWith(siteMeta);
    });
  });
});
