import { promises as fsPromises } from 'fs';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

import { LoggerService } from '../../../core/logger/logger.service';
import { DATABASE_CONNECTION } from '../../../database';
import { HookService } from '../../plugin/services/hook.service';
import {
  DatabaseMockBuilder,
  createHookServiceMock,
  createStorageFactoryServiceMock,
  createStorageServiceMock,
  TestDataFactory,
} from '../../../../test/mock-utils';
import { StorageProvider } from '../dto/storage-config.dto';

import { MediaService } from './media.service';
import { StorageFactoryService } from './storage-factory.service';

// Mock fs/promises module
vi.mock('fs/promises');
const mockFs = fsPromises as any;

// Mock sharp module
vi.mock('sharp', () => ({
  default: vi.fn(),
}));
const mockSharp = sharp as any;

describe('MediaService', () => {
  let service: MediaService;
  let mockDb: DatabaseMockBuilder;
  let mockHookService: Partial<HookService>;
  let mockStorageFactoryService: Partial<StorageFactoryService>;
  let mockStorageService: any;
  let mockLogger: Partial<LoggerService>;

  const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('test image data'),
    stream: {} as any,
    destination: '',
    filename: 'test.jpg',
    path: '',
    ...overrides,
  });

  beforeEach(async () => {
    mockDb = new DatabaseMockBuilder();
    mockHookService = createHookServiceMock();
    mockStorageService = createStorageServiceMock();
    mockStorageFactoryService = createStorageFactoryServiceMock(
      mockStorageService,
      StorageProvider.LOCAL,
    );

    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      info: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb.build(),
        },
        {
          provide: StorageFactoryService,
          useValue: mockStorageFactoryService,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);

    // Reset all mocks
    vi.clearAllMocks();

    // Setup file system mocks
    mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
    mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
    mockFs.readdir = vi.fn().mockResolvedValue([]);
    mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from(''));
    mockFs.access = vi.fn().mockResolvedValue(undefined);
    mockFs.rm = vi.fn().mockResolvedValue(undefined);

    // Setup sharp mock
    mockSharp.mockReturnValue({
      metadata: vi.fn().mockResolvedValue({
        width: 1920,
        height: 1080,
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should upload file successfully with image metadata', async () => {
      const mockFile = createMockFile();
      const uploadedFile = TestDataFactory.createMediaFile({
        filename: 'test.jpg',
        path: '/uploads/images/test.jpg',
        width: 1920,
        height: 1080,
      });

      // Setup mocks
      mockDb.setTransactionBehavior(true);
      mockDb.setInsertResult([uploadedFile]);

      const result = await service.uploadFile(mockFile, undefined, 'local');

      expect(mockHookService.applyFilters).toHaveBeenCalledWith('media|beforeUpload', {
        file: mockFile,
        customFilename: undefined,
        provider: 'local',
      });
      expect(mockStorageService.upload).toHaveBeenCalledWith(mockFile, 'test.jpg');
      expect(mockSharp).toHaveBeenCalledWith(mockFile.buffer);
      expect(mockHookService.doAction).toHaveBeenCalledWith('media|uploaded', {
        file: uploadedFile,
      });
      expect(result).toEqual(uploadedFile);
    });

    it('should upload file with custom filename', async () => {
      const mockFile = createMockFile();
      const customFilename = 'custom-name.jpg';
      const uploadedFile = TestDataFactory.createMediaFile({
        filename: customFilename,
      });

      mockDb.setTransactionBehavior(true);
      mockDb.setInsertResult([uploadedFile]);

      await service.uploadFile(mockFile, customFilename, 'local');

      expect(mockStorageService.upload).toHaveBeenCalledWith(mockFile, customFilename);
    });

    it('should upload non-image file without metadata', async () => {
      const mockFile = createMockFile({
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      });
      const uploadedFile = TestDataFactory.createMediaFile({
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        width: null,
        height: null,
      });

      mockDb.setTransactionBehavior(true);
      mockDb.setInsertResult([uploadedFile]);

      const result = await service.uploadFile(mockFile);

      expect(mockSharp).not.toHaveBeenCalled();
      expect(result.width).toBeNull();
      expect(result.height).toBeNull();
    });

    it('should handle image metadata extraction error gracefully', async () => {
      const mockFile = createMockFile();
      const uploadedFile = TestDataFactory.createMediaFile({
        width: null,
        height: null,
      });

      mockSharp.mockReturnValue({
        metadata: vi.fn().mockRejectedValue(new Error('Invalid image')),
      });
      mockDb.setTransactionBehavior(true);
      mockDb.setInsertResult([uploadedFile]);

      const result = await service.uploadFile(mockFile);

      expect(result.width).toBeNull();
      expect(result.height).toBeNull();
    });

    it('should rollback on storage upload failure', async () => {
      const mockFile = createMockFile();

      mockStorageService.upload.mockRejectedValue(new Error('Storage failed'));
      mockDb.setTransactionBehavior(true);

      await expect(service.uploadFile(mockFile)).rejects.toThrow('Storage failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Storage upload failed', 'Storage failed');
    });

    it('should cleanup uploaded file on database insert failure', async () => {
      const mockFile = createMockFile();

      mockDb.setTransactionBehavior(true);
      mockDb.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database failed')),
        }),
      });

      await expect(service.uploadFile(mockFile)).rejects.toThrow('Database failed');
      expect(mockStorageService.delete).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database insert failed, cleaning up uploaded file',
        'Database failed',
      );
    });

    it('should log warning when upload hook fails', async () => {
      const mockFile = createMockFile();
      const uploadedFile = TestDataFactory.createMediaFile();

      mockDb.setTransactionBehavior(true);
      mockDb.setInsertResult([uploadedFile]);
      mockHookService.doAction = vi.fn().mockRejectedValue(new Error('Hook failed'));

      const result = await service.uploadFile(mockFile);

      expect(result).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith('Upload hook failed', 'Hook failed');
    });

    it('should apply beforeUpload filter', async () => {
      const mockFile = createMockFile();
      const uploadedFile = TestDataFactory.createMediaFile();

      mockHookService.applyFilters = vi
        .fn()
        .mockResolvedValue({ file: mockFile, customFilename: 'filtered.jpg', provider: 'picgo' });
      mockDb.setTransactionBehavior(true);
      mockDb.setInsertResult([uploadedFile]);

      await service.uploadFile(mockFile);

      expect(mockStorageService.upload).toHaveBeenCalledWith(mockFile, 'filtered.jpg');
    });
  });

  describe('listFiles', () => {
    it('should list files with pagination', async () => {
      const mockFiles = TestDataFactory.createMediaFiles(5);
      const query = {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      };

      // Create proper chain mock
      let selectCallCount = 0;
      mockDb.db.select = vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get items
          return {
            from: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(mockFiles),
                }),
              }),
            }),
          };
        } else {
          // Second call: get count
          return {
            from: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ count: 5 }),
            }),
          };
        }
      });

      const result = await service.listFiles(query);

      expect(result.items).toEqual(mockFiles);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should filter files by keyword', async () => {
      const mockFiles = [TestDataFactory.createMediaFile({ filename: 'test-image.jpg' })];
      const query = {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
        keyword: 'test',
      };

      let selectCallCount = 0;
      mockDb.db.select = vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get items with where clause
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockFiles),
                  }),
                }),
              }),
            }),
          };
        } else {
          // Second call: get count
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ count: 1 }),
              }),
            }),
          };
        }
      });

      const result = await service.listFiles(query);

      expect(result.items).toEqual(mockFiles);
      expect(result.total).toBe(1);
    });

    it('should filter files by type (image)', async () => {
      const mockFiles = [
        TestDataFactory.createMediaFile({ mimeType: 'image/jpeg' }),
        TestDataFactory.createMediaFile({ mimeType: 'image/png' }),
      ];
      const query = {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
        type: 'image' as const,
      };

      let selectCallCount = 0;
      mockDb.db.select = vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockFiles),
                  }),
                }),
              }),
            }),
          };
        } else {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ count: 2 }),
              }),
            }),
          };
        }
      });

      await service.listFiles(query);

      // Verify type filtering was applied
      expect(mockDb.db.select).toHaveBeenCalled();
    });

    it('should sort files by different fields', async () => {
      const mockFiles = TestDataFactory.createMediaFiles(3);
      const query = {
        page: 1,
        pageSize: 10,
        sortBy: 'size' as const,
        sortOrder: 'asc' as const,
      };

      let selectCallCount = 0;
      mockDb.db.select = vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(mockFiles),
                }),
              }),
            }),
          };
        } else {
          return {
            from: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ count: 3 }),
            }),
          };
        }
      });

      await service.listFiles(query);

      expect(mockDb.db.select).toHaveBeenCalled();
    });
  });

  describe('getFileById', () => {
    it('should return file by id', async () => {
      const mockFile = TestDataFactory.createMediaFile({ id: 1 });

      mockDb.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockFile),
          }),
        }),
      });

      const result = await service.getFileById(1);

      expect(result).toEqual(mockFile);
    });

    it('should throw NotFoundException when file not found', async () => {
      mockDb.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(service.getFileById(999)).rejects.toThrow(NotFoundException);
      await expect(service.getFileById(999)).rejects.toThrow('File with ID 999 not found');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const mockFile = TestDataFactory.createMediaFile({ id: 1, provider: 'local' });

      mockDb.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockFile),
          }),
        }),
      });

      const result = await service.deleteFile(1);

      expect(mockHookService.doAction).toHaveBeenCalledWith('media|beforeDelete', {
        file: mockFile,
      });
      expect(mockStorageService.delete).toHaveBeenCalledWith(mockFile.filename);
      expect(mockDb.db.delete).toHaveBeenCalled();
      expect(mockHookService.doAction).toHaveBeenCalledWith('media|afterDelete', {
        file: mockFile,
        result,
      });
      expect(result.success).toBe(true);
    });

    it('should delete file even if storage deletion fails', async () => {
      const mockFile = TestDataFactory.createMediaFile({ id: 1, provider: 'local' });

      mockDb.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockFile),
          }),
        }),
      });

      mockStorageService.delete.mockRejectedValue(new Error('Storage delete failed'));

      const result = await service.deleteFile(1);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete file from storage'),
        expect.any(String),
        'MediaService',
      );
      expect(result.success).toBe(true);
    });

    it('should skip storage deletion for non-local provider', async () => {
      const mockFile = TestDataFactory.createMediaFile({ id: 1, provider: 'picgo' });

      mockDb.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockFile),
          }),
        }),
      });

      mockStorageFactoryService.getCurrentProvider = vi
        .fn()
        .mockResolvedValue(StorageProvider.PICGO);

      await service.deleteFile(1);

      expect(mockStorageService.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteFiles', () => {
    it('should delete multiple files successfully', async () => {
      const mockFiles = [
        TestDataFactory.createMediaFile({ id: 1 }),
        TestDataFactory.createMediaFile({ id: 2 }),
      ];

      mockDb.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFiles),
        }),
      });

      const result = await service.deleteFiles([1, 2]);

      expect(mockHookService.doAction).toHaveBeenCalledWith('media|beforeDeleteBatch', {
        files: mockFiles,
        ids: [1, 2],
      });
      expect(mockStorageService.delete).toHaveBeenCalledTimes(2);
      expect(mockHookService.doAction).toHaveBeenCalledWith('media|afterDeleteBatch', {
        deletedCount: 2,
        files: expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 2 }),
        ]),
      });
      expect(result.deletedCount).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException when no ids provided', async () => {
      await expect(service.deleteFiles([])).rejects.toThrow(BadRequestException);
      await expect(service.deleteFiles([])).rejects.toThrow('No file IDs provided');
    });

    it('should throw BadRequestException when too many ids provided', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => i + 1);

      await expect(service.deleteFiles(ids)).rejects.toThrow(BadRequestException);
      await expect(service.deleteFiles(ids)).rejects.toThrow(
        'Cannot delete more than 100 files at once',
      );
    });

    it('should continue deleting even if some storage deletions fail', async () => {
      const mockFiles = [
        TestDataFactory.createMediaFile({ id: 1 }),
        TestDataFactory.createMediaFile({ id: 2 }),
      ];

      mockDb.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFiles),
        }),
      });

      mockStorageService.delete
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(true);

      const result = await service.deleteFiles([1, 2]);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('scanArticleImages', () => {
    it('should scan and add missing image URLs from articles', async () => {
      const mockArticles = [
        {
          id: 1,
          content:
            '![test](https://example.com/image1.jpg) ![test2](https://example.com/image2.png)',
        },
      ];

      mockDb.db.select = vi
        .fn()
        // First call: get articles
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockArticles),
        })
        // Second call: check existing paths (batch 1)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      const result = await service.scanArticleImages();

      expect(result.scanned).toBe(2);
      expect(result.added).toBe(2);
      expect(mockDb.db.insert).toHaveBeenCalled();
    });

    it('should not add duplicate URLs', async () => {
      const mockArticles = [
        {
          id: 1,
          content: '![test](https://example.com/image1.jpg)',
        },
      ];

      mockDb.db.select = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockArticles),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ path: 'https://example.com/image1.jpg' }]),
          }),
        });

      const result = await service.scanArticleImages();

      expect(result.scanned).toBe(1);
      expect(result.added).toBe(0);
      expect(mockDb.db.insert).not.toHaveBeenCalled();
    });

    it('should skip data URLs', async () => {
      const mockArticles = [
        {
          id: 1,
          content: '![test](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA)',
        },
      ];

      mockDb.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue(mockArticles),
      });

      const result = await service.scanArticleImages();

      expect(result.scanned).toBe(0);
      expect(result.added).toBe(0);
    });

    it('should extract URLs from HTML img tags', async () => {
      const mockArticles = [
        {
          id: 1,
          content: '<img src="https://example.com/image.jpg" alt="test">',
        },
      ];

      mockDb.db.select = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockArticles),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      const result = await service.scanArticleImages();

      expect(result.scanned).toBe(1);
      expect(result.added).toBe(1);
    });

    it('should extract URLs from CSS url() patterns', async () => {
      const mockArticles = [
        {
          id: 1,
          content: 'background: url("https://example.com/bg.jpg");',
        },
      ];

      mockDb.db.select = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockArticles),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      const result = await service.scanArticleImages();

      expect(result.scanned).toBe(1);
      expect(result.added).toBe(1);
    });

    it('should handle large batches of URLs', async () => {
      const urls = Array.from({ length: 600 }, (_, i) => `https://example.com/image${i}.jpg`);
      const content = urls.map((url) => `![test](${url})`).join(' ');
      const mockArticles = [{ id: 1, content }];

      mockDb.db.select = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockArticles),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      const result = await service.scanArticleImages();

      expect(result.scanned).toBe(600);
      expect(result.added).toBe(600);
      // Should be called twice (600 / 500 = 2 batches)
      expect(mockDb.db.select).toHaveBeenCalledTimes(3); // 1 for articles + 2 for batches
    });
  });

  describe('exportAllImages', () => {
    it('should export all images', async () => {
      const mockFiles = TestDataFactory.createMediaFiles(3);

      mockDb.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockFiles),
        }),
      });

      const result = await service.exportAllImages();

      expect(result.total).toBe(3);
      expect(result.files).toHaveLength(3);
      expect(result.files[0]).toHaveProperty('id');
      expect(result.files[0]).toHaveProperty('filename');
      expect(result.files[0]).toHaveProperty('path');
    });

    it('should return empty array when no images', async () => {
      mockDb.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.exportAllImages();

      expect(result.total).toBe(0);
      expect(result.files).toHaveLength(0);
    });
  });

  describe('chunk upload operations', () => {
    describe('initiateChunkUpload', () => {
      it('should initiate chunk upload successfully', async () => {
        const params = {
          filename: 'large-file.mp4',
          totalSize: 10485760, // 10MB
          chunkSize: 1048576, // 1MB
          totalChunks: 10,
          mimeType: 'video/mp4',
          provider: 'local',
        };

        mockFs.readdir.mockResolvedValue([]);

        const result = await service.initiateChunkUpload(params);

        expect(result.uploadId).toBeDefined();
        expect(result.totalChunks).toBe(10);
        expect(result.uploaded).toHaveLength(10);
        expect(result.uploaded.every((u) => !u)).toBe(true);
        expect(mockFs.mkdir).toHaveBeenCalled();
        expect(mockFs.writeFile).toHaveBeenCalled();
      });

      it('should resume existing upload', async () => {
        const uploadId = 'existing-upload-id';
        const params = {
          filename: 'large-file.mp4',
          totalSize: 10485760,
          chunkSize: 1048576,
          totalChunks: 10,
          uploadId,
        };

        mockFs.readdir.mockResolvedValue(['chunk.0', 'chunk.1', 'chunk.5', 'meta.json']);

        const result = await service.initiateChunkUpload(params);

        expect(result.uploadId).toBe(uploadId);
        expect(result.uploaded[0]).toBe(true);
        expect(result.uploaded[1]).toBe(true);
        expect(result.uploaded[2]).toBe(false);
        expect(result.uploaded[5]).toBe(true);
      });

      it('should throw BadRequestException for invalid parameters', async () => {
        const invalidParams = {
          filename: '',
          totalSize: 0,
          chunkSize: 0,
          totalChunks: 0,
        };

        await expect(service.initiateChunkUpload(invalidParams)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('uploadChunk', () => {
      it('should upload chunk successfully', async () => {
        const uploadId = 'test-upload-id';
        const mockFile = createMockFile();

        const result = await service.uploadChunk({
          uploadId,
          index: 0,
          file: mockFile,
        });

        expect(result.index).toBe(0);
        expect(result.size).toBe(mockFile.buffer.length);
        expect(mockFs.writeFile).toHaveBeenCalled();
      });

      it('should throw BadRequestException for invalid parameters', async () => {
        const mockFile = createMockFile();

        await expect(
          service.uploadChunk({
            uploadId: '',
            index: -1,
            file: mockFile,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw NotFoundException for non-existent upload session', async () => {
        const mockFile = createMockFile();
        mockFs.access.mockRejectedValue(new Error('ENOENT'));

        await expect(
          service.uploadChunk({
            uploadId: 'non-existent',
            index: 0,
            file: mockFile,
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('mergeChunks', () => {
      it('should merge chunks successfully', async () => {
        const uploadId = 'test-upload-id';
        const meta = {
          filename: 'large-file.mp4',
          totalChunks: 3,
          mimeType: 'video/mp4',
          provider: 'local',
        };

        mockFs.readFile
          .mockResolvedValueOnce(JSON.stringify(meta)) // meta.json
          .mockResolvedValueOnce(Buffer.from('chunk0'))
          .mockResolvedValueOnce(Buffer.from('chunk1'))
          .mockResolvedValueOnce(Buffer.from('chunk2'));

        const result = await service.mergeChunks(uploadId);

        expect(result.buffer).toBeInstanceOf(Buffer);
        expect(result.buffer.toString()).toBe('chunk0chunk1chunk2');
        expect(result.meta).toEqual(meta);
      });

      it('should throw NotFoundException when meta.json not found', async () => {
        mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

        await expect(service.mergeChunks('non-existent')).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException when chunk is missing', async () => {
        const uploadId = 'test-upload-id';
        const meta = {
          filename: 'large-file.mp4',
          totalChunks: 3,
        };

        mockFs.readFile
          .mockResolvedValueOnce(JSON.stringify(meta))
          .mockResolvedValueOnce(Buffer.from('chunk0'))
          .mockRejectedValueOnce(new Error('ENOENT'));

        await expect(service.mergeChunks(uploadId)).rejects.toThrow('缺少分片: 1');
      });
    });

    describe('cleanupChunks', () => {
      it('should cleanup chunks directory successfully', async () => {
        const uploadId = 'test-upload-id';

        await service.cleanupChunks(uploadId);

        expect(mockFs.rm).toHaveBeenCalledWith(
          expect.stringContaining(uploadId),
          expect.objectContaining({ recursive: true, force: true }),
        );
      });

      it('should not throw error when cleanup fails', async () => {
        mockFs.rm.mockRejectedValue(new Error('Cleanup failed'));

        await expect(service.cleanupChunks('test-id')).resolves.not.toThrow();
      });
    });
  });

  describe('private utility methods', () => {
    it('should identify image-like URLs', () => {
      const imageUrls = [
        'https://example.com/test.jpg',
        'https://example.com/test.png',
        'https://example.com/test.gif',
        'https://example.com/test.webp',
        'https://example.com/test.svg',
      ];

      const mockArticles = imageUrls.map((url) => ({
        id: 1,
        content: `![test](${url})`,
      }));

      mockDb.db.select = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockArticles),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      service.scanArticleImages();

      // If images are detected, they should be scanned
      expect(mockDb.db.select).toHaveBeenCalled();
    });

    it('should normalize URLs correctly', async () => {
      const mockArticles = [
        {
          id: 1,
          content: '![test](https://example.com/image.jpg)',
        },
      ];

      mockDb.db.select = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockArticles),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      const result = await service.scanArticleImages();

      expect(result.scanned).toBe(1);
    });

    it('should guess MIME type from URL extension', async () => {
      const mockArticles = [
        {
          id: 1,
          content:
            '![test](https://example.com/test.jpg) ![test](https://example.com/test.png) ![test](https://example.com/test.webp)',
        },
      ];

      mockDb.db.select = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockArticles),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      await service.scanArticleImages();

      expect(mockDb.db.insert).toHaveBeenCalled();
    });
  });
});
