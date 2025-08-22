import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MockUtils, type DatabaseMockBuilder } from '../../../test/mock-utils';

import { StorageProvider } from './dto/storage-config.dto';
import { MediaService } from './services/media.service';

import type { StorageService } from './interfaces/storage.interface';
import type { StorageFactoryService } from './services/storage-factory.service';
import type { LoggerService } from '../../core/logger/logger.service';
import type { HookService } from '../plugin/services/hook.service';
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
  let mockHookService: Partial<HookService>;
  let mockLogger: LoggerService;

  beforeEach(() => {
    // 使用Mock工具类创建数据库Mock
    databaseMock = new MockUtils.database();

    // 使用Mock工具类创建存储服务Mock
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
      databaseMock.build() as unknown as LibSQLDatabase,
      mockStorageFactoryService as StorageFactoryService,
      mockHookService as HookService,
      mockLogger,
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

      // 直接 mock db 查询方法（无过滤条件分支：from -> orderBy -> limit -> offset）
      const mockOffset = vi.fn().mockResolvedValue(mockFiles);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });

      // Mock count query（无过滤条件：from -> get）
      const mockCountGet = vi.fn().mockResolvedValue({ count: 2 });
      const mockCountFrom = vi.fn().mockReturnValue({ get: mockCountGet });

      service.db.select = vi.fn().mockImplementation((fields) => {
        if (fields != null && typeof fields === 'object' && 'count' in fields) {
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

      // 直接 mock db 查询方法（有过滤条件分支：from -> where -> orderBy -> limit -> offset）
      const mockOffset = vi.fn().mockResolvedValue(mockFiles);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      // Mock count query（有过滤条件：from -> where -> get）
      const mockCountGet = vi.fn().mockResolvedValue({ count: 1 });
      const mockCountWhere = vi.fn().mockReturnValue({ get: mockCountGet });
      const mockCountFrom = vi.fn().mockReturnValue({ where: mockCountWhere });

      service.db.select = vi.fn().mockImplementation((fields) => {
        if (fields != null && typeof fields === 'object' && 'count' in fields) {
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
      const mockGet = vi.fn().mockResolvedValue(mockFile);
      const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      service.db.select = mockSelect;

      const result = await service.getFileById(1);

      expect(result).toEqual(mockFile);
      expect(mockSelect).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent file', async () => {
      // 直接 mock db 查询方法返回空
      const mockGet = vi.fn().mockResolvedValue(undefined);
      const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
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
      const mockGet = vi.fn().mockResolvedValue(mockFile);
      const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
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
      // 直接 mock db 查询方法返回空
      const mockGet = vi.fn().mockResolvedValue(undefined);
      const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
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

      // 直接 mock db 查询方法（包含 orderBy 链）
      const mockOrderBy = vi.fn().mockResolvedValue(mockFiles);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });

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

  describe('scanArticleImages', () => {
    it('should scan article contents, deduplicate URLs and insert missing ones', async () => {
      // Arrange: two articles with various image URL patterns and duplicates
      const articlesRows = [
        {
          id: 1,
          content:
            '![alt](/uploads/img1.png) <img src="https://example.com/pics/pic.jpg"/> background:url(\'/assets/icons/icon.svg\') ![x](data:image/png;base64,xxx)',
        },
        {
          id: 2,
          content:
            'Some text and duplicate image ![a](/uploads/img1.png) and css url(/styles/bg.webp?size=small)',
        },
      ];

      // Extracted unique URLs expected by implementation (data: should be ignored)
      const allUnique = new Set<string>([
        '/uploads/img1.png',
        'https://example.com/pics/pic.jpg',
        '/assets/icons/icon.svg',
        '/styles/bg.webp?size=small',
      ]);

      // Existing static_files paths (already present): will be excluded from insertion
      const existingPaths = [
        { path: 'https://example.com/pics/pic.jpg' },
        { path: '/assets/icons/icon.svg' },
      ];

      // Mock db.select behavior
      const mockFromArticles = vi.fn().mockResolvedValue(articlesRows);
      const mockWhereStaticFiles = vi.fn().mockResolvedValue(existingPaths);
      const mockFromStaticFiles = vi.fn().mockReturnValue({ where: mockWhereStaticFiles });

      service.db.select = vi.fn().mockImplementation((fields: Record<string, unknown>) => {
        if ('content' in fields) {
          // select articles
          return { from: mockFromArticles } as any;
        }
        if ('path' in fields) {
          // select existing static files
          return { from: mockFromStaticFiles } as any;
        }
        throw new Error('Unexpected select fields');
      });

      // Mock db.insert(...).values(...).returning()
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      service.db.insert = mockInsert as unknown as typeof service.db.insert;

      // Act
      const result = await service.scanArticleImages();

      // Assert
      expect(result.scanned).toBe(allUnique.size);
      expect(result.added).toBe(2); // only two missing should be inserted

      // Verify values() called with the two missing URLs mapped to records
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledTimes(1);
      const valuesArg = (mockValues as any).mock.calls[0][0] as any[];
      const cmp = (a: string, b: string): number => a.localeCompare(b);
      const insertedPaths = valuesArg.map((x: any) => x.path).sort(cmp);
      expect(insertedPaths).toEqual(['/styles/bg.webp?size=small', '/uploads/img1.png'].sort(cmp));

      // mimeType guess should be consistent with extensions
      const mimeTypes = Object.fromEntries(valuesArg.map((x: any) => [x.path, x.mimeType]));
      expect(mimeTypes['/uploads/img1.png']).toBe('image/png');
      expect(mimeTypes['/styles/bg.webp?size=small']).toBe('image/webp');
    });

    it('should return zero when no image urls found', async () => {
      // Arrange: articles without any image urls
      const articlesRows = [
        { id: 1, content: 'no images here' },
        { id: 2, content: 'just text and links http://example.com but no images' },
      ];

      const mockFromArticles = vi.fn().mockResolvedValue(articlesRows);
      service.db.select = vi.fn().mockImplementation((fields: Record<string, unknown>) => {
        if ('content' in fields) {
          return { from: mockFromArticles } as any;
        }
        // In this case, static_files select should never be called
        const dummyFrom = vi.fn();
        return { from: dummyFrom } as any;
      });

      const mockValues = vi.fn();
      service.db.insert = vi
        .fn()
        .mockReturnValue({ values: mockValues }) as unknown as typeof service.db.insert;

      // Act
      const result = await service.scanArticleImages();

      // Assert
      expect(result.scanned).toBe(0);
      expect(result.added).toBe(0);
      expect(mockValues).not.toHaveBeenCalled();
    });
  });
});
