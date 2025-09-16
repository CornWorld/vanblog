import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { MockUtils, type DatabaseMockBuilder } from '../../../test/mock-utils';

import { StorageProvider } from './dto/storage-config.dto';
import { MediaService } from './services/media.service';

import type { StorageService, UploadResult } from './interfaces/storage.interface';
import type { StorageFactoryService } from './services/storage-factory.service';
import type { LoggerService } from '../../core/logger/logger.service';
import type { Database } from '../../database';
import type { HookService } from '../plugin/services/hook.service';

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
  })),
}));

/**
 * Linus 式事务原子性测试
 *
 * 核心原则：
 * 1. 存储失败时，不应该有数据库记录
 * 2. 数据库失败时，存储文件应该被清理
 * 3. 钩子失败不应该影响主流程
 * 4. 所有操作要么全部成功，要么全部失败
 */
describe('MediaService - Transaction Atomicity', () => {
  let service: MediaService;
  let mockStorageService: Partial<StorageService>;
  let databaseMock: DatabaseMockBuilder;
  let mockStorageFactoryService: Partial<StorageFactoryService>;
  let mockHookService: Partial<HookService>;
  let mockLogger: LoggerService;

  beforeEach(() => {
    databaseMock = new MockUtils.database();
    mockStorageService = MockUtils.services.createStorageServiceMock();

    mockStorageFactoryService = {
      getStorageService: vi.fn().mockResolvedValue(mockStorageService),
      getCurrentProvider: vi.fn().mockResolvedValue(StorageProvider.LOCAL),
    };

    mockHookService = {
      applyFilters: vi
        .fn()
        .mockImplementation(async (_hookName, data) => await Promise.resolve(data)),
      doAction: vi.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      log: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    } as unknown as LoggerService;

    service = new MediaService(
      databaseMock.build() as unknown as Database,
      mockStorageFactoryService as StorageFactoryService,
      mockHookService as HookService,
      mockLogger,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Storage Failure Scenarios', () => {
    it('should not create database record when storage upload fails', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      // 模拟存储服务失败
      if (mockStorageService.upload) {
        vi.mocked(mockStorageService.upload).mockRejectedValue(new Error('Storage service down'));
      }

      // 模拟数据库事务
      const mockTransaction = vi.fn();
      service.db.transaction = mockTransaction;

      await expect(service.uploadFile(mockFile)).rejects.toThrow('Storage service down');

      // 验证事务没有被调用（因为存储在事务外失败）
      expect(mockTransaction).not.toHaveBeenCalled();

      // 验证错误被正确记录
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Storage upload failed',
        'Error: Storage service down',
      );
    });

    it('should handle storage timeout gracefully', async () => {
      const mockFile = {
        originalname: 'large.jpg',
        buffer: Buffer.alloc(100 * 1024 * 1024), // 100MB
        size: 100 * 1024 * 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      // 模拟存储超时
      if (mockStorageService.upload) {
        vi.mocked(mockStorageService.upload).mockRejectedValue(new Error('Upload timeout'));
      }

      await expect(service.uploadFile(mockFile)).rejects.toThrow('Upload timeout');

      // 验证没有数据库操作
      expect(service.db.transaction).not.toHaveBeenCalled();
    });
  });

  describe('Database Failure Scenarios', () => {
    it('should cleanup uploaded file when database insert fails', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      // 模拟存储成功
      if (mockStorageService.upload) {
        vi.mocked(mockStorageService.upload).mockResolvedValue({
          filename: 'test-uploaded.jpg',
          url: '/uploads/test-uploaded.jpg',
        } as UploadResult);
      }

      // 模拟数据库插入失败
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        // 模拟事务内的数据库操作失败
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockRejectedValue(new Error('Database constraint violation')),
            }),
          }),
        };
        return await callback(mockTx);
      });

      service.db.transaction = mockTransaction;

      await expect(service.uploadFile(mockFile)).rejects.toThrow('Database constraint violation');

      // 验证存储服务的删除方法被调用
      expect(mockStorageService.delete).toHaveBeenCalledWith('test-uploaded.jpg');

      // 验证错误被正确记录
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database insert failed, cleaning up uploaded file',
        'Error: Database constraint violation',
      );
    });

    it('should handle cleanup failure gracefully', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      // 模拟存储成功
      if (mockStorageService.upload) {
        vi.mocked(mockStorageService.upload).mockResolvedValue({
          filename: 'test-uploaded.jpg',
          url: '/uploads/test-uploaded.jpg',
        } as UploadResult);
      }

      // 模拟删除失败
      if (mockStorageService.delete) {
        vi.mocked(mockStorageService.delete).mockRejectedValue(new Error('Delete failed'));
      }

      // 模拟数据库插入失败
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockRejectedValue(new Error('Database error')),
            }),
          }),
        };
        return await callback(mockTx);
      });

      service.db.transaction = mockTransaction;

      await expect(service.uploadFile(mockFile)).rejects.toThrow('Database error');

      // 验证清理尝试被记录
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup uploaded file after database error',
        'Error: Delete failed',
      );

      // 验证原始错误仍然被抛出
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database insert failed, cleaning up uploaded file',
        'Error: Database error',
      );
    });
  });

  describe('Hook Failure Scenarios', () => {
    it('should complete upload even when hook fails', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const mockMediaFile = MockUtils.testData.createMediaFile({
        id: 1,
        filename: 'test-uploaded.jpg',
      });

      // 模拟存储成功
      if (mockStorageService.upload) {
        vi.mocked(mockStorageService.upload).mockResolvedValue({
          filename: 'test-uploaded.jpg',
          url: '/uploads/test-uploaded.jpg',
        } as UploadResult);
      }

      // 模拟数据库成功
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockMediaFile]),
            }),
          }),
        };
        return await callback(mockTx);
      });

      service.db.transaction = mockTransaction;

      // 模拟钩子失败
      if (mockHookService.doAction) {
        vi.mocked(mockHookService.doAction).mockRejectedValue(new Error('Hook service down'));
      }

      const result = await service.uploadFile(mockFile);

      // 验证上传仍然成功
      expect(result).toEqual(mockMediaFile);

      // 验证钩子失败被记录但不影响主流程
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Upload hook failed',
        'Error: Hook service down',
      );

      // 验证存储和数据库操作都成功
      expect(mockStorageService.upload).toHaveBeenCalled();
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('Complete Success Scenarios', () => {
    it('should complete all operations atomically when everything succeeds', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const mockMediaFile = MockUtils.testData.createMediaFile({
        id: 1,
        filename: 'test-uploaded.jpg',
        path: '/uploads/test-uploaded.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      });

      // 模拟所有操作成功
      if (mockStorageService.upload) {
        vi.mocked(mockStorageService.upload).mockResolvedValue({
          filename: 'test-uploaded.jpg',
          url: '/uploads/test-uploaded.jpg',
        } as UploadResult);
      }

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockMediaFile]),
            }),
          }),
        };
        return await callback(mockTx);
      });

      service.db.transaction = mockTransaction;

      const result = await service.uploadFile(mockFile);

      // 验证结果正确
      expect(result).toEqual(mockMediaFile);

      // 验证所有步骤都被执行
      expect(mockStorageService.upload).toHaveBeenCalledWith(mockFile, 'test.jpg');
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockHookService.doAction).toHaveBeenCalledWith('media|uploaded', { file: result });

      // 验证没有错误日志
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
