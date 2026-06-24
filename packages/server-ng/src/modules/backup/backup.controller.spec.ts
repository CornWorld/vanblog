import { StreamableFile } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { mkdirSync, writeFileSync, unlinkSync } from 'fs';

import { Mock } from '@test/mock';

import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { PermissionService } from '../permission/permission.service';

import type { CreateBackupDto, RestoreBackupDto, GetBackupsDto } from './dto/backup.dto';
import type { Response } from 'express';

describe('BackupController', () => {
  let controller: BackupController;
  let mockBackupService: any;
  let mockPermissionService: any;
  let testBackupDir: string;

  beforeEach(async () => {
    mockBackupService = Mock.backup();
    mockPermissionService = Mock.permission();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackupController],
      providers: [
        {
          provide: BackupService,
          useValue: mockBackupService,
        },
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
      ],
    }).compile();

    controller = module.get<BackupController>(BackupController);

    // Reset mocks
    vi.clearAllMocks();

    // Create test backup directory
    testBackupDir = `${process.cwd()}/data/backups`;
    mkdirSync(testBackupDir, { recursive: true });

    // Clean up any leftover test file from previous runs
    const testFilePath = `${testBackupDir}/test-backup.vbak`;
    try {
      unlinkSync(testFilePath);
    } catch {
      // File doesn't exist, ignore
    }
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const createBackupDto: CreateBackupDto = {
        name: 'test-backup',
        description: 'Test backup',
        includeMedia: true,
        includeAnalytics: false,
        includeLogs: false,
      };

      const expectedResult = {
        id: 'backup-id',
        name: 'test-backup',
        description: 'Test backup',
        filename: 'test-backup.vbak',
        size: 1024,
        hasPassword: false,
        includeMedia: true,
        includeAnalytics: false,
        includeLogs: false,
        createdAt: '2023-01-01T00:00:00.000Z',
        tables: { users: 1, articles: 5 },
      };

      mockBackupService.createBackup.mockResolvedValue(expectedResult);

      const result = await controller.createBackup(createBackupDto);

      expect(mockBackupService.createBackup).toHaveBeenCalledWith(createBackupDto);
      expect(result).toEqual(expectedResult);
    });

    it('should create an encrypted backup', async () => {
      const createBackupDto: CreateBackupDto = {
        name: 'encrypted-backup',
        password: 'TestPassword123!',
        includeMedia: true,
        includeAnalytics: false,
        includeLogs: false,
      };

      const expectedResult = {
        id: 'backup-id',
        name: 'encrypted-backup',
        filename: 'encrypted-backup.vbak',
        size: 2048,
        hasPassword: true,
        includeMedia: true,
        includeAnalytics: true,
        includeLogs: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        tables: { users: 1, articles: 5 },
      };

      mockBackupService.createBackup.mockResolvedValue(expectedResult);

      const result = await controller.createBackup(createBackupDto);

      expect(mockBackupService.createBackup).toHaveBeenCalledWith(createBackupDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getBackups', () => {
    it('should return paginated backup list', async () => {
      const getBackupsDto: GetBackupsDto = {
        page: 1,
        limit: 10,
      };

      const expectedResult = {
        backups: [
          {
            id: 'backup-1',
            name: 'backup-1',
            filename: 'backup-1.vbak',
            size: 1024,
            hasPassword: false,
            includeMedia: true,
            includeAnalytics: false,
            includeLogs: false,
            createdAt: '2023-01-01T00:00:00.000Z',
            tables: { users: 1 },
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockBackupService.getBackups.mockResolvedValue(expectedResult);

      const result = await controller.getBackups(getBackupsDto);

      expect(mockBackupService.getBackups).toHaveBeenCalledWith(getBackupsDto);
      expect(result).toEqual(expectedResult);
    });

    it('should filter backups by search term', async () => {
      const getBackupsDto: GetBackupsDto = {
        page: 1,
        limit: 10,
        search: 'important',
      };

      const expectedResult = {
        backups: [
          {
            id: 'backup-1',
            name: 'important-backup',
            filename: 'important-backup.vbak',
            size: 1024,
            hasPassword: false,
            includeMedia: true,
            includeAnalytics: false,
            includeLogs: false,
            createdAt: '2023-01-01T00:00:00.000Z',
            tables: { users: 1 },
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockBackupService.getBackups.mockResolvedValue(expectedResult);

      const result = await controller.getBackups(getBackupsDto);

      expect(mockBackupService.getBackups).toHaveBeenCalledWith(getBackupsDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('downloadBackup', () => {
    it('should download backup file successfully', async () => {
      const filename = 'test-backup.vbak';
      const mockResponse = {
        set: vi.fn(),
      } as unknown as Response;

      // Create actual test backup file
      const testFilePath = `${testBackupDir}/${filename}`;
      writeFileSync(testFilePath, 'mock backup content');

      const result = controller.downloadBackup(filename, mockResponse);

      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': 19, // Length of "mock backup content"
      });
      expect(result).toBeInstanceOf(StreamableFile);

      // Close the stream to prevent async errors
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (result && 'getStream' in result) {
        (result as any).getStream().destroy();
      }
    });

    it('should throw error for non-existent file', () => {
      const filename = 'non-existent.vbak';
      const mockResponse = {} as Response;

      expect(() => controller.downloadBackup(filename, mockResponse)).toThrow(
        'Backup file not found',
      );
    });

    it('should throw error for invalid filename', () => {
      const filename = '../../../etc/passwd';
      const mockResponse = {} as Response;

      expect(() => controller.downloadBackup(filename, mockResponse)).toThrow('Invalid filename');
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup successfully', async () => {
      const filename = 'test-backup.vbak';

      mockBackupService.deleteBackup.mockResolvedValue(undefined);

      await controller.deleteBackup(filename);

      expect(mockBackupService.deleteBackup).toHaveBeenCalledWith(filename);
    });

    it('should throw error for invalid filename', async () => {
      const filename = '../../../etc/passwd';

      await expect(controller.deleteBackup(filename)).rejects.toThrow('Invalid filename');
    });
  });

  describe('restoreBackup', () => {
    it('should start restore task successfully', async () => {
      const filename = 'test-backup.vbak';
      const restoreBackupDto: RestoreBackupDto = {
        overwriteExisting: true,
        restoreMedia: true,
        restoreAnalytics: false,
        restoreLogs: false,
      };

      const expectedResult = { taskId: 'task-123' };

      mockBackupService.restoreBackup.mockResolvedValue(expectedResult);

      const result = await controller.restoreBackup(filename, restoreBackupDto);

      expect(mockBackupService.restoreBackup).toHaveBeenCalledWith(filename, restoreBackupDto);
      expect(result).toEqual(expectedResult);
    });

    it('should start restore with password', async () => {
      const filename = 'encrypted-backup.vbak';
      const restoreBackupDto: RestoreBackupDto = {
        password: 'TestPassword123!',
        overwriteExisting: false,
        restoreMedia: true,
        restoreAnalytics: false,
        restoreLogs: false,
      };

      const expectedResult = { taskId: 'task-456' };

      mockBackupService.restoreBackup.mockResolvedValue(expectedResult);

      const result = await controller.restoreBackup(filename, restoreBackupDto);

      expect(mockBackupService.restoreBackup).toHaveBeenCalledWith(filename, restoreBackupDto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw error for invalid filename', async () => {
      const filename = '../../../etc/passwd';
      const restoreBackupDto: RestoreBackupDto = {
        overwriteExisting: false,
        restoreMedia: true,
        restoreAnalytics: false,
        restoreLogs: false,
      };

      await expect(controller.restoreBackup(filename, restoreBackupDto)).rejects.toThrow(
        'Invalid filename',
      );
    });
  });

  describe('restoreBackupFromBody', () => {
    it('should delegate to backupService.restoreFromBackup', async () => {
      mockBackupService.restoreFromBackup.mockResolvedValue(undefined);

      const result = await controller.restoreBackupFromBody({ filename: 'test.vbak' });

      expect(mockBackupService.restoreFromBackup).toHaveBeenCalledWith({ filename: 'test.vbak' });
      expect(result).toEqual({ success: true });
    });

    it('should propagate service errors', async () => {
      mockBackupService.restoreFromBackup.mockRejectedValue(new Error('Invalid restore request'));

      await expect(controller.restoreBackupFromBody({})).rejects.toThrow('Invalid restore request');
    });
  });

  describe('exportBackup', () => {
    it('should delegate to backupService.exportBackup', async () => {
      const mockBuffer = Buffer.from('backup-data');
      mockBackupService.exportBackup.mockResolvedValue(mockBuffer);

      const result = await controller.exportBackup();

      expect(mockBackupService.exportBackup).toHaveBeenCalled();
      expect(result).toBe(mockBuffer);
    });
  });

  describe('importBackup', () => {
    it('should delegate to backupService.importBackup', async () => {
      const mockFile = {
        buffer: Buffer.from('data'),
        originalname: 'backup.vbak',
      } as Express.Multer.File;
      mockBackupService.importBackup.mockResolvedValue(undefined);

      const result = await controller.importBackup(mockFile);

      expect(mockBackupService.importBackup).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual({ success: true });
    });
  });

  describe('getRestoreProgress', () => {
    it('should return restore progress', () => {
      const taskId = 'task-123';
      const expectedResult = {
        taskId,
        status: 'running' as const,
        progress: 50,
        currentTable: 'articles',
        message: 'Restoring articles...',
      };

      mockBackupService.getRestoreProgress.mockReturnValue(expectedResult);

      const result = controller.getRestoreProgress(taskId);

      expect(mockBackupService.getRestoreProgress).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(expectedResult);
    });

    it('should return completed status', () => {
      const taskId = 'task-456';
      const expectedResult = {
        taskId,
        status: 'completed' as const,
        progress: 100,
        message: 'Restore completed successfully',
      };

      mockBackupService.getRestoreProgress.mockReturnValue(expectedResult);

      const result = controller.getRestoreProgress(taskId);

      expect(mockBackupService.getRestoreProgress).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(expectedResult);
    });

    it('should return failed status with error', () => {
      const taskId = 'task-789';
      const expectedResult = {
        taskId,
        status: 'failed' as const,
        progress: 25,
        currentTable: 'users',
        error: 'Database connection failed',
      };

      mockBackupService.getRestoreProgress.mockReturnValue(expectedResult);

      const result = controller.getRestoreProgress(taskId);

      expect(mockBackupService.getRestoreProgress).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(expectedResult);
    });
  });
});
