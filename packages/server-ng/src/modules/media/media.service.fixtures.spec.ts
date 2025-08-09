import { describe, expect, vi, type MockedFunction } from 'vitest';

import { test, ServiceMockFactory } from '../../../test/vitest-fixtures.test';

import { StorageProvider } from './dto/storage-config.dto';
import { MediaService } from './services/media.service';

import type { StorageFactoryService } from './services/storage-factory.service';
import type { HookService } from '../plugin/services/hook.service';

// Mock sharp模块
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
  })),
}));

// 扩展测试上下文，添加MediaService实例
const mediaTest = test.extend<{ mediaService: MediaService }>({
  mediaService: async ({ db, storageFactoryService }, use) => {
    const mockHookService = {
      applyFilters: vi.fn().mockImplementation((_, data) => Promise.resolve(data)),
      doAction: vi.fn().mockResolvedValue(undefined),
    } as Partial<HookService>;

    const service = new MediaService(
      db,
      storageFactoryService as unknown as StorageFactoryService,
      mockHookService as HookService,
    );
    await use(service);
  },
});

describe('MediaService with Vitest Fixtures', () => {
  describe('uploadFile', () => {
    mediaTest(
      'should upload a file successfully',
      async ({ mediaService, databaseMock, storageService, testData }) => {
        // 准备测试数据
        const mockFile = {
          originalname: 'test.jpg',
          buffer: Buffer.from('test'),
          size: 1024,
          mimetype: 'image/jpeg',
        } as Express.Multer.File;

        const mockMediaFile = testData.createMediaFile({
          overrides: {
            filename: 'test.jpg',
            size: 1024,
            mimetype: 'image/jpeg',
          },
        });

        // 设置Mock行为
        databaseMock.setInsertResult([mockMediaFile]);

        // 执行测试
        const result = await mediaService.uploadFile(mockFile);

        // 验证结果
        expect(result).toEqual(mockMediaFile);
        expect(storageService.upload).toHaveBeenCalledWith(mockFile, 'test.jpg');
      },
    );

    mediaTest('should handle upload failure', async ({ mediaService, storageService }) => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      // 模拟存储服务失败
      storageService.upload = vi.fn().mockRejectedValue(new Error('Upload failed'));

      // 验证异常抛出
      await expect(mediaService.uploadFile(mockFile)).rejects.toThrow('Upload failed');
    });
  });

  describe('listFiles', () => {
    mediaTest('should return paginated files', async ({ mediaService, databaseMock, testData }) => {
      const mockFiles = testData.createMediaFiles({ count: 3 });
      const totalCount = 10;

      // 设置查询结果和计数结果
      databaseMock.setMultipleQueryResults({ items: mockFiles, count: [{ count: totalCount }] });

      const result = await mediaService.listFiles({
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items).toEqual(mockFiles);
      expect(result.total).toBe(totalCount);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    mediaTest('should handle empty results', async ({ mediaService, databaseMock }) => {
      databaseMock.setMultipleQueryResults({ items: [], count: [{ count: 0 }] });

      const result = await mediaService.listFiles({
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getFileById', () => {
    mediaTest('should return file when found', async ({ mediaService, databaseMock, testData }) => {
      const mockFile = testData.createMediaFile({ overrides: { id: 1 } });
      databaseMock.setQueryResult([mockFile]);

      const result = await mediaService.getFileById(1);

      expect(result).toEqual(mockFile);
    });

    mediaTest('should throw error when file not found', async ({ mediaService, databaseMock }) => {
      databaseMock.setQueryResult([]);

      await expect(mediaService.getFileById(999)).rejects.toThrow('File with ID 999 not found');
    });
  });

  describe('deleteFile', () => {
    mediaTest(
      'should delete file successfully',
      async ({ mediaService, databaseMock, storageService, testData }) => {
        const mockFile = testData.createMediaFile({ overrides: { id: 1 } });

        // 设置查询和删除结果
        databaseMock.setQueryResult([mockFile]);
        databaseMock.setDeleteResult(1);

        const result = await mediaService.deleteFile(1);

        expect(result.success).toBe(true);
        expect(result.message).toBe('File deleted successfully');
        expect(storageService.delete).toHaveBeenCalledWith(mockFile.filename);
      },
    );

    mediaTest('should throw error when file not found', async ({ mediaService, databaseMock }) => {
      // Mock getFileById to throw NotFoundException
      databaseMock.setQueryResult([]);

      await expect(mediaService.deleteFile(999)).rejects.toThrow('File with ID 999 not found');
    });
  });

  describe('deleteFiles', () => {
    mediaTest(
      'should delete multiple files successfully',
      async ({ mediaService, databaseMock, storageService, testData }) => {
        const mockFiles = testData.createMediaFiles({ count: 2 });

        databaseMock.setQueryResult(mockFiles);
        databaseMock.setDeleteResult(2);

        const result = await mediaService.deleteFiles([1, 2]);

        expect(result.deletedCount).toBe(2);
        expect(result.success).toBe(true);
        expect(storageService.delete).toHaveBeenCalledTimes(2);
      },
    );

    mediaTest(
      'should handle partial deletion failure',
      async ({ mediaService, databaseMock, storageService, testData }) => {
        const mockFiles = testData.createMediaFiles({ count: 2 });

        databaseMock.setQueryResult(mockFiles);
        databaseMock.setDeleteResult(1); // 只删除了1个

        // 模拟存储删除部分失败
        storageService.delete = vi
          .fn()
          .mockResolvedValueOnce(true) // 第一个成功
          .mockRejectedValueOnce(new Error('Delete failed')); // 第二个失败

        const result = await mediaService.deleteFiles([1, 2]);

        expect(result.deletedCount).toBe(2);
        expect(result.success).toBe(true);
      },
    );
  });

  describe('exportAllImages', () => {
    mediaTest(
      'should export all images successfully',
      async ({ mediaService, databaseMock, testData }) => {
        const mockFiles = testData.createMediaFiles({ count: 3 });
        databaseMock.setQueryResult(mockFiles);

        const result = await mediaService.exportAllImages();

        // 验证返回的简化结构
        const expectedFiles = mockFiles.map((file) => ({
          id: file.id,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimeType: file.mimeType, // 注意这里的属性名转换
          createdAt: file.createdAt,
        }));

        expect(result.files).toEqual(expectedFiles);
        expect(result.total).toBe(3);
      },
    );

    mediaTest('should handle empty image list', async ({ mediaService, databaseMock }) => {
      databaseMock.setQueryResult([]);

      const result = await mediaService.exportAllImages();

      expect(result.total).toBe(0);
      expect(result.files).toEqual([]);
    });
  });

  // 使用test.scoped演示不同存储提供商的测试
  describe('with different storage providers', () => {
    describe('Local Storage', () => {
      const localTest = mediaTest.extend<{ storageFactoryService: Partial<StorageFactoryService> }>(
        {
          storageFactoryService: async ({ storageService }, use) => {
            const mock = ServiceMockFactory.createStorageFactoryServiceMock({
              storageService,
              provider: StorageProvider.LOCAL,
            });
            await use(mock);
          },
        },
      );

      localTest('should use local storage provider', async ({ storageFactoryService }) => {
        const provider = await (
          storageFactoryService.getCurrentProvider as MockedFunction<() => Promise<StorageProvider>>
        )();
        expect(provider).toBe(StorageProvider.LOCAL);
      });
    });

    describe('PicGo Storage', () => {
      const picgoTest = mediaTest.extend<{ storageFactoryService: Partial<StorageFactoryService> }>(
        {
          storageFactoryService: async ({ storageService }, use) => {
            const mock = ServiceMockFactory.createStorageFactoryServiceMock({
              storageService,
              provider: StorageProvider.PICGO,
            });
            await use(mock);
          },
        },
      );

      picgoTest('should use PicGo storage provider', async ({ storageFactoryService }) => {
        const provider = await (
          storageFactoryService.getCurrentProvider as MockedFunction<() => Promise<StorageProvider>>
        )();
        expect(provider).toBe(StorageProvider.PICGO);
      });
    });
  });

  // 演示自动化fixture的使用
  describe('with automatic setup and teardown', () => {
    const autoTest = mediaTest.extend({
      autoSetup: [
        async (_, use) => {
          // 自动执行的设置逻辑
          console.log('Setting up test environment...');
          await use(undefined);
          console.log('Cleaning up test environment...');
        },
        { auto: true }, // 标记为自动fixture
      ],
    });

    autoTest('should run with automatic setup', ({ mediaService }) => {
      // 这个测试会自动执行setup和teardown
      expect(mediaService).toBeDefined();
    });
  });
});
