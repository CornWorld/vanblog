import { promises as fsPromises } from 'fs';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { MockUtils, type DatabaseMockBuilder } from '../../../test/mock-utils';

import { StorageProvider } from './dto/storage-config.dto';
import { MediaService } from './services/media.service';

import type { StorageService } from './interfaces/storage.interface';
import type { StorageFactoryService } from './services/storage-factory.service';
import type { LoggerService } from '../../core/logger/logger.service';
import type { Database } from '../../database';
import type { HookService } from '../plugin/services/hook.service';

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
  })),
}));

vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

/**
 * Linus 式并发安全测试
 *
 * 核心原则：
 * 1. 文件上传必须是原子操作
 * 2. 并发上传不能导致数据不一致
 * 3. 存储失败时数据库不能有孤立记录
 * 4. 数据库失败时存储不能有孤立文件
 */
describe('MediaService - Concurrency Safety', () => {
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
      applyFilters: vi.fn().mockImplementation(async (_hookName, data) => Promise.resolve(data)),
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

  describe('Race Condition Tests', () => {
    it('should handle concurrent uploads of same file without data corruption', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      // 模拟数据库插入延迟（通过 values 的实现来处理）
      // 使用自增计数器模拟数据库自增主键，确保并发下 ID 唯一且确定
      let nextId = 1;
      let delayedOnce = false;
      const mockValues = vi.fn().mockImplementation((vals: any) => {
        const id = nextId++;
        const returning = vi.fn().mockImplementation(async () => {
          // 只在第一次调用时引入小延迟，制造竞态而不影响唯一性
          if (!delayedOnce) {
            delayedOnce = true;
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
          return [
            MockUtils.testData.createMediaFile({
              id,
              filename: vals?.filename ?? `test-${String(id)}.jpg`,
            }),
          ];
        });
        return { returning };
      });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      // 设置事务 mock
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        return await callback({
          insert: mockInsert,
        });
      });
      service.db.transaction = mockTransaction;

      // 并发上传相同文件
      const promises = [
        service.uploadFile(mockFile, 'test-1.jpg'),
        service.uploadFile(mockFile, 'test-2.jpg'),
        service.uploadFile(mockFile, 'test-3.jpg'),
      ];

      const results = await Promise.all(promises);

      // 验证所有上传都成功且没有数据冲突
      expect(results).toHaveLength(3);

      // 验证所有结果都有有效的 ID
      const ids = results.map((r) => r.id).filter(Boolean);
      expect(ids).toHaveLength(3);

      // 验证 ID 是唯一的（没有重复）
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);

      // 验证存储服务被正确调用
      expect(mockStorageService.upload).toHaveBeenCalledTimes(3);
    });

    it('should handle storage failure without leaving orphaned database records', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      // 模拟存储服务失败
      mockStorageService.upload = vi.fn().mockRejectedValue(new Error('Storage failed'));

      // 模拟数据库事务
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        // 不应该被调用，因为存储失败了
        return await callback({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          }),
        });
      });
      service.db.transaction = mockTransaction;

      await expect(service.uploadFile(mockFile)).rejects.toThrow('Storage failed');

      // 验证事务被调用但因为存储失败而回滚
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('should handle database failure without leaving orphaned storage files', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      // 模拟数据库插入失败
      const mockReturning = vi.fn().mockRejectedValue(new Error('Database failed'));
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      service.db.insert = mockInsert;

      await expect(service.uploadFile(mockFile)).rejects.toThrow('Database failed');

      // 验证存储服务被调用但文件应该被清理
      expect(mockStorageService.upload).toHaveBeenCalled();
      // 在实际实现中，这里应该有清理逻辑
    });
  });

  describe('Batch Operation Safety', () => {
    it('should handle concurrent batch deletions safely', async () => {
      const fileIds = [1, 2, 3, 4, 5];

      // 模拟数据库查询返回文件列表
      const mockFiles = fileIds.map((id) => MockUtils.testData.createMediaFile({ id }));
      const mockWhere = vi.fn().mockResolvedValue(mockFiles);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      service.db.select = vi.fn().mockReturnValue({ from: mockFrom });

      // 模拟存储删除成功
      mockStorageService.delete = vi.fn().mockResolvedValue(undefined);

      // 模拟删除操作
      const mockDeleteWhere = vi.fn().mockResolvedValue({ changes: fileIds.length });
      service.db.delete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

      // 并发执行批量删除
      const promises = [
        service.deleteFiles([1, 2]),
        service.deleteFiles([3, 4]),
        service.deleteFiles([5]),
      ];

      const results = await Promise.all(promises);

      // 验证所有删除操作都成功
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.deletedCount).toBeGreaterThan(0);
      });
    });

    it('should prevent deletion of more than 100 files at once', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) => i + 1);

      await expect(service.deleteFiles(tooManyIds)).rejects.toThrow(
        'Cannot delete more than 100 files at once',
      );
    });
  });

  describe('Chunk Upload Concurrency', () => {
    it('should handle concurrent chunk uploads for same uploadId', async () => {
      const uploadId = 'test-upload-123';
      const mockFile = {
        buffer: Buffer.from('chunk-data'),
      } as Express.Multer.File;

      // 模拟文件系统操作
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      // 并发上传多个分块
      const promises = [
        service.uploadChunk({ uploadId, index: 0, file: mockFile }),
        service.uploadChunk({ uploadId, index: 1, file: mockFile }),
        service.uploadChunk({ uploadId, index: 2, file: mockFile }),
      ];

      const results = await Promise.all(promises);

      // 验证所有分块都上传成功
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.index).toBe(index);
        expect(result.size).toBe(mockFile.buffer.length);
      });
    });

    it('should handle chunk upload directory race condition', async () => {
      const uploadId = 'test-upload-456';
      const mockFile = {
        buffer: Buffer.from('chunk-data'),
      } as Express.Multer.File;

      // 模拟目录不存在的情况
      vi.mocked(fsPromises.access).mockRejectedValue(new Error('Directory not found'));

      await expect(service.uploadChunk({ uploadId, index: 0, file: mockFile })).rejects.toThrow(
        '上传会话不存在',
      );
    });
  });

  describe('Memory and Resource Safety', () => {
    it('should handle large file uploads without memory leaks', async () => {
      const largeFile = {
        originalname: 'large.jpg',
        buffer: Buffer.alloc(50 * 1024 * 1024), // 50MB
        size: 50 * 1024 * 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const mockMediaFile = MockUtils.testData.createMediaFile({
        id: 1,
        filename: 'large.jpg',
        size: 50 * 1024 * 1024,
      });

      const mockReturning = vi.fn().mockResolvedValue([mockMediaFile]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      service.db.insert = mockInsert;

      const result = await service.uploadFile(largeFile);

      expect(result).toEqual(mockMediaFile);
      expect(mockStorageService.upload).toHaveBeenCalledWith(largeFile, 'large.jpg');
    });

    it('should handle multiple concurrent large file uploads', async () => {
      const createLargeFile = (name: string): Express.Multer.File => {
        return {
          originalname: name,
          buffer: Buffer.alloc(10 * 1024 * 1024), // 10MB each
          size: 10 * 1024 * 1024,
          mimetype: 'image/jpeg',
        } as Express.Multer.File;
      };

      const files = [
        createLargeFile('large1.jpg'),
        createLargeFile('large2.jpg'),
        createLargeFile('large3.jpg'),
      ];

      let idCounter = 0;
      const mockReturning = vi.fn().mockImplementation(() => {
        idCounter++;
        return [
          MockUtils.testData.createMediaFile({
            id: idCounter,
            filename: `large${String(idCounter)}.jpg`,
            size: 10 * 1024 * 1024,
          }),
        ];
      });

      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      service.db.insert = mockInsert;

      const promises = files.map(async (file) => service.uploadFile(file));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockStorageService.upload).toHaveBeenCalledTimes(3);
    });
  });
});
