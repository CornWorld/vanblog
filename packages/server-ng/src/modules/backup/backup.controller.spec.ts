import * as fs from 'fs';

import { StreamableFile } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { PermissionService } from '../permission/permission.service';

import type { CreateBackupDto, RestoreBackupDto, GetBackupsDto } from './dto/backup.dto';
import type { Response } from 'express';

// Mock fs module
vi.mock('fs');
const mockFs = fs as any;

describe('BackupController', () => {
  let controller: BackupController;
  let mockBackupService: any;
  let mockPermissionService: any;

  beforeEach(async () => {
    mockBackupService = Mock.createBackupServiceMock();
    mockPermissionService = Mock.createPermissionServiceMock();

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
    it('should download backup file successfully', () => {
      const filename = 'test-backup.vbak';
      const mockResponse = {
        set: vi.fn(),
      } as unknown as Response;

      // Mock file system
      const mockReadStream = {
        pipe: vi.fn(),
      };
      mockFs.existsSync = vi.fn().mockReturnValue(true);
      mockFs.createReadStream = vi.fn().mockReturnValue(mockReadStream as any);
      mockFs.statSync = vi.fn().mockReturnValue({ size: 1024 } as any);

      const result = controller.downloadBackup(filename, mockResponse);

      expect(mockFs.existsSync).toHaveBeenCalled();
      expect(mockFs.createReadStream).toHaveBeenCalled();
      expect(mockFs.statSync).toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': 1024,
      });
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it('should throw error for non-existent file', () => {
      const filename = 'non-existent.vbak';
      const mockResponse = {} as Response;

      mockFs.existsSync.mockReturnValue(false);

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
