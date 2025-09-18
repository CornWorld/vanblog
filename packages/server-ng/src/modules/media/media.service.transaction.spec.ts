import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { MockUtils, type DatabaseMockBuilder } from '../../../test/mock-utils';

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

describe('MediaService - Transaction Atomicity', () => {
  let mediaService: MediaService;
  let mockStorageService: StorageService;
  let mockStorageFactory: StorageFactoryService;
  let mockLogger: LoggerService;
  let mockDatabase: Database;
  let mockHookService: HookService;
  let mockDbBuilder: DatabaseMockBuilder;

  beforeEach(() => {
    // Create database mock
    mockDbBuilder = new MockUtils.database();
    mockDatabase = mockDbBuilder.build() as unknown as Database;

    // Mock storage service
    mockStorageService = {
      upload: vi.fn(),
      delete: vi.fn(),
      getUrl: vi.fn(),
      getMetadata: vi.fn(),
    } as StorageService;

    // Mock storage factory
    mockStorageFactory = {
      getStorageService: vi.fn().mockReturnValue(mockStorageService),
    } as unknown as StorageFactoryService;

    // Mock logger
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as LoggerService;

    // Mock hook service
    mockHookService = {
      addAction: vi.fn(),
      addFilter: vi.fn(),
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      doAction: vi.fn().mockResolvedValue(undefined),
      applyFilters: vi.fn().mockImplementation(async (_, value) => Promise.resolve(value)),
      hasAction: vi.fn().mockReturnValue(false),
      hasFilter: vi.fn().mockReturnValue(false),
      getActionCount: vi.fn().mockReturnValue(0),
      getFilterCount: vi.fn().mockReturnValue(0),
    } as unknown as HookService;

    mediaService = new MediaService(mockDatabase, mockStorageFactory, mockHookService, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Storage Failure Scenarios', () => {
    it('should handle storage upload failure gracefully', async () => {
      // Arrange
      const file = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      const uploadError = new Error('Storage upload failed');
      mockStorageService.upload = vi.fn().mockRejectedValue(uploadError);

      // Mock transaction
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        return await callback(mockDatabase);
      });
      (mockDatabase as any).transaction = mockTransaction;

      // Act & Assert
      await expect(mediaService.uploadFile(file, 'test-category')).rejects.toThrow(
        'Storage upload failed',
      );

      // Verify transaction was called
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockStorageService.upload).toHaveBeenCalledWith(
        file,
        expect.stringContaining('test.jpg'),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Storage upload failed',
        'Error: Storage upload failed',
      );
    });

    it('should handle storage service unavailable', async () => {
      // Arrange
      const file = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      mockStorageFactory.getStorageService = vi.fn().mockReturnValue(null);

      // Mock transaction
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        return await callback(mockDatabase);
      });
      (mockDatabase as any).transaction = mockTransaction;

      // Act & Assert
      await expect(mediaService.uploadFile(file, 'test-category')).rejects.toThrow();

      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Database Failure Scenarios', () => {
    it('should rollback transaction on database insert failure', async () => {
      // Arrange
      const file = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      const uploadResult: UploadResult = {
        filename: 'uploads/test.jpg',
        url: 'https://example.com/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      };

      mockStorageService.upload = vi.fn().mockResolvedValue(uploadResult);

      // Mock database insert failure
      const dbError = new Error('Database insert failed');
      mockDbBuilder.setInsertResult([]).reset();
      const mockInsert = vi.fn().mockRejectedValue(dbError);
      mockDbBuilder.db.insert = mockInsert;

      // Mock transaction that properly handles rollback
      const mockTransaction = vi.fn().mockRejectedValue(dbError);
      (mockDatabase as any).transaction = mockTransaction;

      // Act & Assert
      await expect(mediaService.uploadFile(file, 'test-category')).rejects.toThrow(
        'Database insert failed',
      );

      // Verify transaction was called and failed
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockStorageService.upload).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database insert failed, cleaning up uploaded file',
        'Error: Database insert failed',
      );
    });

    it('should handle transaction creation failure', async () => {
      // Arrange
      const file = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      // Mock transaction failure
      const transactionError = new Error('Transaction creation failed');
      (mockDatabase as any).transaction = vi.fn().mockRejectedValue(transactionError);

      // Act & Assert
      await expect(mediaService.uploadFile(file, 'test-category')).rejects.toThrow(
        'Transaction creation failed',
      );

      expect((mockDatabase as any).transaction).toHaveBeenCalledTimes(1);
      // 注意：当事务创建失败时，不会有任何日志记录，因为代码根本没有执行到那里
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up storage on database failure', async () => {
      // Arrange
      const file = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      const uploadResult: UploadResult = {
        filename: 'uploads/test.jpg',
        url: 'https://example.com/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      };

      mockStorageService.upload = vi.fn().mockResolvedValue(uploadResult);
      mockStorageService.delete = vi.fn().mockResolvedValue(undefined);

      // Mock database failure after storage upload
      const dbError = new Error('Database operation failed');
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        // Execute the transaction callback to simulate real transaction behavior
        return await callback({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockRejectedValue(dbError),
            }),
          }),
        });
      });
      (mockDatabase as any).transaction = mockTransaction;

      // Act & Assert
      await expect(mediaService.uploadFile(file, 'test-category')).rejects.toThrow(
        'Database operation failed',
      );

      // Verify cleanup was attempted
      expect(mockStorageService.upload).toHaveBeenCalled();
      expect(mockStorageService.delete).toHaveBeenCalledWith(uploadResult.filename);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup failure gracefully', async () => {
      // Arrange
      const file = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      const uploadResult: UploadResult = {
        filename: 'uploads/test.jpg',
        url: 'https://example.com/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      };

      mockStorageService.upload = vi.fn().mockResolvedValue(uploadResult);

      // Mock cleanup failure
      const cleanupError = new Error('Cleanup failed');
      mockStorageService.delete = vi.fn().mockRejectedValue(cleanupError);

      // Mock database failure
      const dbError = new Error('Database failed');
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        // Execute the transaction callback to simulate real transaction behavior
        return await callback({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockRejectedValue(dbError),
            }),
          }),
        });
      });
      (mockDatabase as any).transaction = mockTransaction;

      // Act & Assert
      await expect(mediaService.uploadFile(file, 'test-category')).rejects.toThrow(
        'Database failed',
      );

      // Verify both operations were attempted
      expect(mockStorageService.upload).toHaveBeenCalled();
      expect(mockStorageService.delete).toHaveBeenCalledWith(uploadResult.filename);
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      // Should log both errors
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database insert failed, cleaning up uploaded file',
        'Error: Database failed',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup uploaded file after database error',
        'Error: Cleanup failed',
      );
    });
  });
});
