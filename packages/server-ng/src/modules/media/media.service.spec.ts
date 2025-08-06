import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MockUtils, type DatabaseMockBuilder } from '../../../test/mock-utils';

import { StorageProvider } from './dto/storage-config.dto';
import { MediaService } from './services/media.service';

import type { StorageService } from './interfaces/storage.interface';
import type { StorageFactoryService } from './services/storage-factory.service';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
  })),
}));

describe('MediaService', () => {
  let service: MediaService;
  let mockStorageService: Partial<StorageService>;
  let databaseMock: DatabaseMockBuilder;
  let mockStorageFactoryService: Partial<StorageFactoryService>;

  beforeEach(() => {
    // 使用Mock工具类创建数据库Mock
    databaseMock = new MockUtils.database();

    // 使用Mock工具类创建存储服务Mock
    mockStorageService = MockUtils.services.createStorageServiceMock();

    mockStorageFactoryService = {
      getStorageService: vi.fn().mockResolvedValue(mockStorageService),
      getCurrentProvider: vi.fn().mockResolvedValue(StorageProvider.LOCAL),
    };

    service = new MediaService(
      databaseMock.build() as unknown as LibSQLDatabase,
      mockStorageFactoryService as StorageFactoryService,
    );
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const mockMediaFile = MockUtils.testData.createMediaFile({
        id: 1,
        filename: 'test.jpg',
        path: '/uploads/images/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      });

      // 直接 mock db 插入方法
      const mockReturning = vi.fn().mockResolvedValue([mockMediaFile]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      service.db.insert = mockInsert;

      const result = await service.uploadFile(mockFile);

      expect(mockStorageService.upload).toHaveBeenCalledWith(mockFile, 'test.jpg');
      expect(result).toEqual(mockMediaFile);
    });

    it('should use custom filename if provided', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const mockMediaFile = MockUtils.testData.createMediaFile({
        id: 1,
        filename: 'custom.jpg',
        path: '/uploads/images/custom.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      });

      // 直接 mock db 插入方法
      const mockReturning = vi.fn().mockResolvedValue([mockMediaFile]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      service.db.insert = mockInsert;

      const result = await service.uploadFile(mockFile, 'custom.jpg');

      expect(result).toEqual(mockMediaFile);
      expect(databaseMock.db.insert).toHaveBeenCalled();
      expect(mockStorageService.upload).toHaveBeenCalledWith(mockFile, 'custom.jpg');
    });
  });

  describe('listFiles', () => {
    it('should list files with pagination', async () => {
      const mockFiles = [
        MockUtils.testData.createMediaFile({ id: 1, filename: 'test1.jpg' }),
        MockUtils.testData.createMediaFile({ id: 2, filename: 'test2.jpg' }),
      ];

      // 直接 mock db 查询方法
      const mockOffset = vi.fn().mockResolvedValue(mockFiles);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      // Mock count query
      const mockCountWhere = vi.fn().mockResolvedValue([{ count: 2 }]);
      const mockCountFrom = vi.fn().mockReturnValue({ where: mockCountWhere });

      service.db.select = vi.fn().mockImplementation((fields) => {
        if (fields && typeof fields === 'object' && 'count' in fields) {
          // This is a count query
          return { from: mockCountFrom };
        }
        // This is a regular select query
        return { from: mockFrom };
      });

      const result = await service.listFiles({
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items).toEqual(mockFiles);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(databaseMock.db.select).toHaveBeenCalled();
    });

    it('should filter files by keyword', async () => {
      const mockFiles = [MockUtils.testData.createMediaFile({ id: 1, filename: 'test.jpg' })];

      // 直接 mock db 查询方法
      const mockOffset = vi.fn().mockResolvedValue(mockFiles);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      // Mock count query
      const mockCountWhere = vi.fn().mockResolvedValue([{ count: 1 }]);
      const mockCountFrom = vi.fn().mockReturnValue({ where: mockCountWhere });

      service.db.select = vi.fn().mockImplementation((fields) => {
        if (fields && typeof fields === 'object' && 'count' in fields) {
          // This is a count query
          return { from: mockCountFrom };
        }
        // This is a regular select query
        return { from: mockFrom };
      });

      const result = await service.listFiles({
        keyword: 'test',
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items).toEqual(mockFiles);
      expect(result.total).toBe(1);
      expect(databaseMock.db.select).toHaveBeenCalled();
    });
  });

  describe('getFileById', () => {
    it('should return file by id', async () => {
      const mockFile = {
        id: 1,
        filename: 'test.jpg',
        originalName: 'test.jpg',
        path: '/uploads/images/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        provider: 'local',
        createdAt: new Date(),
        updatedAt: new Date(),
        width: 1920,
        height: 1080,
        blurhash: 'testhash',
      };

      // 直接 mock db 查询方法
      const mockLimit = vi.fn().mockResolvedValue([mockFile]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      service.db.select = mockSelect;

      const result = await service.getFileById(1);

      expect(result).toEqual(mockFile);
      expect(mockSelect).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent file', async () => {
      // 直接 mock db 查询方法返回空数组
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      service.db.select = vi.fn().mockReturnValue({ from: mockFrom });

      await expect(service.getFileById(999)).rejects.toThrow('File with ID 999 not found');
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      const mockFile = {
        id: 1,
        filename: 'test.jpg',
        path: '/uploads/images/test.jpg',
        provider: 'local',
      };

      // 直接 mock db 查询方法
      const mockLimit = vi.fn().mockResolvedValue([mockFile]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      const mockDelete = {
        where: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      const mockDeleteFrom = vi.fn().mockReturnValue(mockDelete);

      service.db.select = vi.fn().mockReturnValue({ from: mockFrom });
      service.db.delete = mockDeleteFrom;

      const result = await service.deleteFile(1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('File deleted successfully');
      expect(mockStorageService.delete).toHaveBeenCalledWith('test.jpg');
    });

    it('should throw NotFoundException for non-existent file', async () => {
      // 直接 mock db 查询方法返回空数组
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      service.db.select = vi.fn().mockReturnValue({ from: mockFrom });

      await expect(service.deleteFile(999)).rejects.toThrow('File with ID 999 not found');
    });
  });

  describe('deleteFiles', () => {
    it('should delete multiple files successfully', async () => {
      const mockFiles = [
        { id: 1, filename: 'test1.jpg', provider: 'local' },
        { id: 2, filename: 'test2.jpg', provider: 'local' },
      ];

      // 直接 mock db 查询方法
      const mockQuery = {
        where: vi.fn().mockResolvedValue(mockFiles),
      };
      const mockFrom = vi.fn().mockReturnValue(mockQuery);

      const mockDelete = {
        where: vi.fn().mockResolvedValue({ changes: 2 }),
      };
      const mockDeleteFrom = vi.fn().mockReturnValue(mockDelete);

      service.db.select = vi.fn().mockReturnValue({ from: mockFrom });
      service.db.delete = mockDeleteFrom;

      const result = await service.deleteFiles([1, 2]);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(databaseMock.db.select).toHaveBeenCalled();
      expect(mockStorageService.delete).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException for empty IDs array', async () => {
      await expect(service.deleteFiles([])).rejects.toThrow('No file IDs provided');
    });
  });

  describe('exportAllImages', () => {
    it('should export all images', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'image1.jpg',
          path: '/uploads/images/image1.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 2,
          filename: 'image2.png',
          path: '/uploads/images/image2.png',
          size: 2048,
          mimeType: 'image/png',
          createdAt: new Date('2023-01-02'),
        },
      ];

      // 直接 mock db 查询方法
      const mockFrom = vi.fn().mockResolvedValue(mockFiles);

      service.db.select = vi.fn().mockReturnValue({ from: mockFrom });

      const result = await service.exportAllImages();

      expect(result.total).toBe(2);
      expect(result.files).toEqual([
        {
          id: 1,
          filename: 'image1.jpg',
          path: '/uploads/images/image1.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          createdAt: expect.any(Date),
        },
        {
          id: 2,
          filename: 'image2.png',
          path: '/uploads/images/image2.png',
          size: 2048,
          mimeType: 'image/png',
          createdAt: expect.any(Date),
        },
      ]);
      expect(databaseMock.db.select).toHaveBeenCalled();
    });
  });
});
