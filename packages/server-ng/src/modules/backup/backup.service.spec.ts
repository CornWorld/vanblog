import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';

import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { LoggerService } from '../../core/logger/logger.service';
import { DATABASE_CONNECTION } from '../../database/database.module';

import { BackupService } from './backup.service';

import type { CreateBackupDto, RestoreBackupDto, GetBackupsDto } from './dto/backup.dto';

// Mock fs module
vi.mock('fs/promises');
const mockFs = fs as any;

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnValue([]),
  delete: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  run: vi.fn().mockResolvedValue(undefined),
};

// Mock logger
const mockLogger = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);

    // Reset mocks
    vi.clearAllMocks();
    mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
    mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
    mockFs.readdir = vi.fn().mockResolvedValue([]);
    mockFs.stat = vi.fn().mockResolvedValue({ size: 1024 } as any);
    mockFs.readFile = vi.fn().mockResolvedValue('{}');
    mockFs.unlink = vi.fn().mockResolvedValue(undefined);
    mockFs.access = vi.fn().mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const createBackupDto: CreateBackupDto = {
        name: 'test-backup',
        description: 'Test backup description',
        includeMedia: true,
        includeAnalytics: false,
        includeLogs: false,
      };

      const result = await service.createBackup(createBackupDto);

      expect(result).toMatchObject({
        name: 'test-backup',
        description: 'Test backup description',
        hasPassword: false,
        includeMedia: true,
        includeAnalytics: false,
        includeLogs: false,
      });
      expect(result.id).toBeDefined();
      expect(result.filename).toContain('.vbak');
      expect(result.size).toBe(1024);
      expect(result.createdAt).toBeDefined();
      expect(result.tables).toBeDefined();

      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Creating backup'));
    });

    it('should create a backup with password', async () => {
      const createBackupDto: CreateBackupDto = {
        name: 'encrypted-backup',
        password: 'TestPassword123!',
        includeMedia: true,
        includeAnalytics: true,
        includeLogs: true,
      };

      const result = await service.createBackup(createBackupDto);

      expect(result.hasPassword).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle backup creation failure', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const createBackupDto: CreateBackupDto = {
        name: 'failing-backup',
        includeMedia: true,
        includeAnalytics: false,
        includeLogs: false,
      };

      await expect(service.createBackup(createBackupDto)).rejects.toThrow(
        'Failed to create backup',
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getBackups', () => {
    it('should return paginated backup list', async () => {
      const mockFiles = ['backup1.vbak', 'backup2.vbak', 'other.txt'];
      mockFs.readdir.mockResolvedValue(mockFiles as any);
      mockFs.stat.mockResolvedValue({ size: 2048 } as any);

      // Mock compressed backup content
      const mockBackupContent = JSON.stringify({
        metadata: {
          id: 'test-id',
          name: 'test-backup',
          description: 'Test description',
          version: '1.0.0',
          createdAt: '2023-01-01T00:00:00.000Z',
          hasPassword: false,
          includeMedia: true,
          includeAnalytics: false,
          includeLogs: false,
          tables: { users: 1, articles: 5 },
        },
      });

      // Mock gzip compression
      const compressed = zlib.gzipSync(Buffer.from(mockBackupContent));
      mockFs.readFile.mockResolvedValue(compressed);

      const getBackupsDto: GetBackupsDto = {
        page: 1,
        limit: 10,
      };

      const result = await service.getBackups(getBackupsDto);

      expect(result.backups).toHaveLength(2); // Only .vbak files
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.backups[0]).toMatchObject({
        id: 'test-id',
        name: 'test-backup',
        filename: expect.stringContaining('.vbak'),
        size: 2048,
      });
    });

    it('should filter backups by search term', async () => {
      const mockFiles = ['important-backup.vbak', 'test-backup.vbak'];
      mockFs.readdir.mockResolvedValue(mockFiles as any);
      mockFs.stat.mockResolvedValue({ size: 1024, mtime: new Date('2023-01-01T00:00:00Z') } as any);

      // Mock different content for each file
      mockFs.readFile.mockImplementation(async (filepath: string) => {
        const filename = path.basename(filepath);
        let mockBackupContent;

        if (filename.includes('important')) {
          mockBackupContent = JSON.stringify({
            metadata: {
              id: 'test-id-1',
              name: 'important-backup',
              version: '1.0.0',
              createdAt: '2023-01-01T00:00:00.000Z',
              hasPassword: false,
              includeMedia: true,
              includeAnalytics: false,
              includeLogs: false,
              tables: {},
            },
          });
        } else {
          mockBackupContent = JSON.stringify({
            metadata: {
              id: 'test-id-2',
              name: 'test-backup',
              version: '1.0.0',
              createdAt: '2023-01-01T00:00:00.000Z',
              hasPassword: false,
              includeMedia: true,
              includeAnalytics: false,
              includeLogs: false,
              tables: {},
            },
          });
        }

        const compressed = zlib.gzipSync(Buffer.from(mockBackupContent));
        return Promise.resolve(compressed);
      });

      const getBackupsDto: GetBackupsDto = {
        page: 1,
        limit: 10,
        search: 'important',
      };

      const result = await service.getBackups(getBackupsDto);

      expect(result.backups).toHaveLength(1);
      expect(result.backups[0].name).toBe('important-backup');
    });

    it('should handle encrypted backup metadata', async () => {
      const mockFiles = ['encrypted.vbak'];
      mockFs.readdir.mockResolvedValue(mockFiles as any);
      mockFs.stat.mockResolvedValue({ size: 1024, mtime: new Date('2023-01-01T00:00:00Z') } as any);

      // Mock encrypted content that can't be parsed as JSON
      const encryptedContent = 'encrypted-data-that-is-not-json';
      const compressed = zlib.gzipSync(Buffer.from(encryptedContent));
      mockFs.readFile.mockResolvedValue(compressed);

      const getBackupsDto: GetBackupsDto = {
        page: 1,
        limit: 10,
      };

      const result = await service.getBackups(getBackupsDto);

      expect(result.backups).toHaveLength(1);
      expect(result.backups[0].name).toBe('Encrypted Backup');
      expect(result.backups[0].hasPassword).toBe(true);
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup successfully', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      await service.deleteBackup('test-backup.vbak');

      expect(mockFs.access).toHaveBeenCalled();
      expect(mockFs.unlink).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Backup deleted'));
    });

    it('should throw NotFoundException for non-existent backup', async () => {
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);

      await expect(service.deleteBackup('non-existent.vbak')).rejects.toThrow(
        'Backup file not found',
      );
    });
  });

  describe('restoreBackup', () => {
    it('should start restore task successfully', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const restoreDto: RestoreBackupDto = {
        overwriteExisting: true,
        restoreMedia: true,
        restoreAnalytics: false,
        restoreLogs: false,
      };

      const result = await service.restoreBackup('test-backup.vbak', restoreDto);

      expect(result.taskId).toBeDefined();
      expect(mockFs.access).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent backup', async () => {
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);

      const restoreDto: RestoreBackupDto = {
        overwriteExisting: false,
        restoreMedia: true,
        restoreAnalytics: false,
        restoreLogs: false,
      };

      await expect(service.restoreBackup('non-existent.vbak', restoreDto)).rejects.toThrow(
        'Backup file not found',
      );
    });
  });

  describe('getRestoreProgress', () => {
    it('should return restore progress', async () => {
      // First start a restore task
      mockFs.access.mockResolvedValue(undefined);
      const restoreDto: RestoreBackupDto = {
        overwriteExisting: false,
        restoreMedia: true,
        restoreAnalytics: false,
        restoreLogs: false,
      };
      const { taskId } = await service.restoreBackup('test-backup.vbak', restoreDto);

      const progress = service.getRestoreProgress(taskId);

      expect(progress).toMatchObject({
        taskId,
        status: 'running',
        progress: 0,
      });
    });

    it('should throw NotFoundException for non-existent task', () => {
      expect(() => service.getRestoreProgress('non-existent-task')).toThrow(
        'Restore task not found',
      );
    });
  });
});
