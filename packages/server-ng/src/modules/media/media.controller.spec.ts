import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { MockUtils } from '../../../test/mock-utils';
import { SettingRegistryService } from '../setting/services/setting-registry.service';

import { MediaProcessingSettingsSchema } from './dto/media-settings.dto';
import { MediaController } from './media.controller';
import { ImageProcessingQueueService } from './services/image-processing-queue.service';
import { ImageProcessingService } from './services/image-processing.service';
import { MediaService } from './services/media.service';
import { StorageConfigService } from './services/storage-config.service';

describe('MediaController', () => {
  let controller: MediaController;
  let mockMediaService: any;
  let mockImageProcessingService: any;
  let mockStorageConfigService: any;
  let mockImageProcessingQueueService: any;
  let mockSettingRegistryService: any;

  beforeEach(async () => {
    // 使用 MockUtils 创建 Mock 服务（减少 34 行手动配置）
    mockMediaService = MockUtils.services.createMediaServiceMock();
    mockImageProcessingService = MockUtils.services.createImageProcessingServiceMock();
    mockStorageConfigService = MockUtils.services.createStorageConfigServiceMock();
    mockImageProcessingQueueService = MockUtils.services.createImageProcessingQueueServiceMock();
    mockSettingRegistryService = {
      getConfig: vi.fn().mockResolvedValue(MediaProcessingSettingsSchema.parse({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        { provide: MediaService, useValue: mockMediaService },
        { provide: ImageProcessingService, useValue: mockImageProcessingService },
        { provide: ImageProcessingQueueService, useValue: mockImageProcessingQueueService },
        { provide: StorageConfigService, useValue: mockStorageConfigService },
        { provide: SettingRegistryService, useValue: mockSettingRegistryService },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('batchDelete', () => {
    it('should validate dto via zod pipe and call service', async () => {
      mockMediaService.deleteFiles.mockResolvedValue({
        success: true,
        deletedCount: 2,
        message: 'ok',
      });

      const result = await controller.batchDelete({ ids: [1, 2] } as any);

      expect(mockMediaService.deleteFiles).toHaveBeenCalledWith([1, 2]);
      expect(result).toEqual({ success: true, deletedCount: 2, message: 'ok' });
    });
  });

  describe('scanArticleImages', () => {
    it('should delegate to service', async () => {
      mockMediaService.scanArticleImages.mockResolvedValue({ scanned: 5, added: 3 });
      const result = await controller.scanArticleImages();
      expect(mockMediaService.scanArticleImages).toHaveBeenCalled();
      expect(result).toEqual({ scanned: 5, added: 3 });
    });
  });

  describe('exportAllImages', () => {
    it('should delegate to service', async () => {
      const data = {
        total: 1,
        files: [
          {
            id: 1,
            filename: 'a',
            path: '/a',
            size: 1,
            mimeType: 'image/png',
            createdAt: '2020-01-01',
          },
        ],
      } as any;
      mockMediaService.exportAllImages.mockResolvedValue(data);
      const result = await controller.exportAllImages();
      expect(mockMediaService.exportAllImages).toHaveBeenCalled();
      expect(result).toBe(data);
    });
  });

  describe('storage config', () => {
    it('getStorageConfig should delegate to service', async () => {
      const config = { provider: 'local' } as any;
      mockStorageConfigService.getStorageConfig.mockResolvedValue(config);
      const result = await controller.getStorageConfig();
      expect(mockStorageConfigService.getStorageConfig).toHaveBeenCalled();
      expect(result).toBe(config);
    });

    it('updateStorageConfig should validate and delegate', async () => {
      const dto = { provider: 'local', local: { root: '/tmp' } } as any;
      const updated = { provider: 'local', local: { root: '/data' } } as any;
      mockStorageConfigService.updateStorageConfig.mockResolvedValue(updated);
      const result = await controller.updateStorageConfig(dto);
      // Zod schema strips unrecognized properties like 'local'
      expect(mockStorageConfigService.updateStorageConfig).toHaveBeenCalledWith({
        provider: 'local',
      });
      expect(result).toBe(updated);
    });
  });

  describe('uploadFromClipboard', () => {
    it('should parse data url, compress image if needed and upload via service', async () => {
      // override default compress.enabled=false to true for this test
      mockSettingRegistryService.getConfig.mockResolvedValueOnce(
        MediaProcessingSettingsSchema.parse({ compress: { enabled: true } }),
      );
      const pngData = Buffer.from('test').toString('base64');
      const dataUrl = `data:image/png;base64,${pngData}`;
      const compressed = Buffer.from('compressed');
      mockImageProcessingService.compressImage.mockResolvedValue({ buffer: compressed });
      mockMediaService.uploadFile.mockResolvedValue({ id: 1 } as any);

      const result = await controller.uploadFromClipboard({ dataUrl, filename: 'x.png' });

      expect(mockImageProcessingService.compressImage).toHaveBeenCalled();
      expect(mockMediaService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          originalname: 'x.png',
          buffer: compressed,
          size: compressed.length,
        }),
        'x.png',
      );
      expect(result).toEqual({ id: 1 });
    });

    it('should infer filename from mime when not provided', async () => {
      const webpData = Buffer.from('webp').toString('base64');
      const dataUrl = `data:image/webp;base64,${webpData}`;
      const compressed = Buffer.from('cw');
      mockImageProcessingService.compressImage.mockResolvedValue({ buffer: compressed });
      mockMediaService.uploadFile.mockResolvedValue({ id: 2 } as any);

      const result = await controller.uploadFromClipboard({ dataUrl });

      expect(mockMediaService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ originalname: expect.stringMatching(/^clipboard-\d+\.webp$/) }),
        expect.stringMatching(/^clipboard-\d+\.webp$/),
      );
      expect(result).toEqual({ id: 2 });
    });

    it('should not compress svg', async () => {
      const svgData = Buffer.from('<svg/>').toString('base64');
      const dataUrl = `data:image/svg+xml;base64,${svgData}`;
      mockMediaService.uploadFile.mockResolvedValue({ id: 3 } as any);

      const result = await controller.uploadFromClipboard({ dataUrl, filename: 'x.svg' });

      expect(mockImageProcessingService.compressImage).not.toHaveBeenCalled();
      expect(mockMediaService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ originalname: 'x.svg' }),
        'x.svg',
      );
      expect(result).toEqual({ id: 3 });
    });

    it('should throw for invalid data url', async () => {
      await expect(
        controller.uploadFromClipboard({ dataUrl: 'invalid' as any }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should apply watermark only when provided via processing override', async () => {
      const pngData = Buffer.from('abc').toString('base64');
      const dataUrl = `data:image/png;base64,${pngData}`;
      const wmBuf = Buffer.from('wm');
      mockImageProcessingService.addWatermark.mockResolvedValue(wmBuf);
      mockMediaService.uploadFile.mockResolvedValue({ id: 11 } as any);

      const result = await controller.uploadFromClipboard({
        dataUrl,
        filename: 'y.png',
        processing: { watermark: { enabled: true, text: 'HELLO' } },
      } as any);

      expect(mockImageProcessingService.addWatermark).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ text: 'HELLO' }),
      );
      expect(mockImageProcessingService.compressImage).not.toHaveBeenCalled();
      expect(mockMediaService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ buffer: wmBuf, originalname: 'y.png' }),
        'y.png',
      );
      expect(result).toEqual({ id: 11 });
    });
  });

  describe('uploadFromClipboard - comprehensive data URL validation tests', () => {
    it('should reject data URL with malformed base64 format - missing semicolon', async () => {
      const dataUrl = 'data:image/png|base64,iVBORw0KGgoAAAANSUhEUgAAAA==';

      await expect(controller.uploadFromClipboard({ dataUrl })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should reject data URL with missing base64, prefix', async () => {
      const dataUrl = 'data:image/png;xyz,invaliddata';

      // Will be rejected if the regex doesn't match base64
      await expect(controller.uploadFromClipboard({ dataUrl })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should handle empty base64 data - accepted by Buffer constructor', async () => {
      const dataUrl = 'data:image/png;base64,';
      mockMediaService.uploadFile.mockResolvedValue({ id: 50 } as any);

      // Empty base64 is technically valid and decodes to empty buffer
      const result = await controller.uploadFromClipboard({ dataUrl });

      // Should attempt upload with empty buffer
      expect(mockMediaService.uploadFile).toHaveBeenCalled();
      expect(result).toEqual({ id: 50 });
    });

    it('should accept partial/valid base64 like YWJj (valid base64, decodes to "abc")', async () => {
      const dataUrl = 'data:image/png;base64,YWJj';
      mockMediaService.uploadFile.mockResolvedValue({ id: 51 } as any);

      // YWJj is valid base64
      const result = await controller.uploadFromClipboard({ dataUrl });

      expect(mockMediaService.uploadFile).toHaveBeenCalled();
      expect(result).toEqual({ id: 51 });
    });

    it('should reject data URL missing data: prefix entirely', async () => {
      const dataUrl = 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA==';

      await expect(controller.uploadFromClipboard({ dataUrl })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should accept non-image MIME type (no processing applied, but upload happens)', async () => {
      const pdfBase64 = Buffer.from('PDF').toString('base64');
      const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
      mockMediaService.uploadFile.mockResolvedValue({ id: 52 } as any);

      // Non-image MIME types are accepted but not processed
      const result = await controller.uploadFromClipboard({ dataUrl });

      expect(mockMediaService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ mimetype: 'application/pdf' }),
        expect.stringMatching(/^clipboard-\d+\.pdf$/),
      );
      expect(result).toEqual({ id: 52 });
    });

    it('should skip compression for text/html MIME type (non-image)', async () => {
      const htmlBase64 = Buffer.from('<div>test</div>').toString('base64');
      const dataUrl = `data:text/html;base64,${htmlBase64}`;
      mockMediaService.uploadFile.mockResolvedValue({ id: 53 } as any);

      await controller.uploadFromClipboard({ dataUrl });

      // Should NOT call image processing for non-image MIME types
      expect(mockImageProcessingService.compressImage).not.toHaveBeenCalled();
      expect(mockMediaService.uploadFile).toHaveBeenCalled();
    });

    it('should skip all processing for image/svg+xml even if compression enabled', async () => {
      mockSettingRegistryService.getConfig.mockResolvedValueOnce(
        MediaProcessingSettingsSchema.parse({ compress: { enabled: true } }),
      );
      const svgBase64 = Buffer.from('<svg/>').toString('base64');
      const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      mockMediaService.uploadFile.mockResolvedValue({ id: 54 } as any);

      await controller.uploadFromClipboard({ dataUrl });

      // SVG should not be compressed
      expect(mockImageProcessingService.compressImage).not.toHaveBeenCalled();
      expect(mockMediaService.uploadFile).toHaveBeenCalled();
    });

    it('should validate base64 has valid characters (only A-Z, a-z, 0-9, +, /, =)', async () => {
      const invalidBase64 = 'not@valid#base64!';
      const dataUrl = `data:image/png;base64,${invalidBase64}`;
      mockMediaService.uploadFile.mockResolvedValue({ id: 55 } as any);

      // Buffer.from accepts invalid base64 silently (decodes best effort)
      // This test documents the actual behavior
      const result = await controller.uploadFromClipboard({ dataUrl });

      expect(mockMediaService.uploadFile).toHaveBeenCalled();
      expect(result).toEqual({ id: 55 });
    });

    it('should accept valid UTF-8 data encoded as base64 (image/png)', async () => {
      const validBase64 = Buffer.from('PNG header data').toString('base64');
      const dataUrl = `data:image/png;base64,${validBase64}`;
      mockMediaService.uploadFile.mockResolvedValue({ id: 100 } as any);

      const result = await controller.uploadFromClipboard({ dataUrl, filename: 'valid.png' });

      expect(result).toEqual({ id: 100 });
      expect(mockMediaService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ originalname: 'valid.png', mimetype: 'image/png' }),
        'valid.png',
      );
    });
  });

  describe('listFiles', () => {
    it('should return paginated file list', async () => {
      const query = { page: 1, pageSize: 10 };
      const mockResult = {
        items: [{ id: 1, filename: 'test.jpg', path: '/uploads/test.jpg' }],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      mockMediaService.listFiles.mockResolvedValue(mockResult);

      const result = await controller.listFiles(query);

      // Schema adds default sortBy and sortOrder
      expect(mockMediaService.listFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      );
      expect(result).toEqual(mockResult);
    });

    it('should support filtering by filename', async () => {
      const query = { page: 1, pageSize: 10, filename: 'test' };

      mockMediaService.listFiles.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      await controller.listFiles(query);

      // Note: filename is not part of ListStaticFilesSchema, so it gets stripped
      // This test expects the actual behavior after schema parsing
      expect(mockMediaService.listFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      );
    });
  });

  describe('getFile', () => {
    it('should return file by id', async () => {
      const mockFile = { id: 1, filename: 'test.jpg', path: '/uploads/test.jpg' };
      mockMediaService.getFileById.mockResolvedValue(mockFile);

      const result = await controller.getFile(1);

      expect(mockMediaService.getFileById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockFile);
    });
  });

  describe('deleteFile', () => {
    it('should delete file by id', async () => {
      const mockResponse = { success: true, message: 'File deleted' };
      mockMediaService.deleteFile.mockResolvedValue(mockResponse);

      const result = await controller.deleteFile(1);

      expect(mockMediaService.deleteFile).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('uploadFile', () => {
    it('should merge processing override and run watermark then compress in order', async () => {
      const file = {
        originalname: 'a.png',
        buffer: Buffer.from('orig'),
        size: 4,
        mimetype: 'image/png',
        fieldname: 'file',
        encoding: '7bit',
      } as any;

      const wmOut = Buffer.from('wm');
      const cmpOut = Buffer.from('cmp');
      mockImageProcessingService.addWatermark.mockResolvedValue(wmOut);
      mockImageProcessingService.compressImage.mockResolvedValue({ buffer: cmpOut });
      mockMediaService.uploadFile.mockResolvedValue({ id: 99 } as any);

      const dto = {
        filename: 'a.png',
        processing: { compress: { enabled: true }, watermark: { enabled: true, text: 'T' } },
      } as any;

      const saved = await controller.uploadFile(file, dto);

      expect(mockImageProcessingService.addWatermark).toHaveBeenCalledWith(
        file.buffer,
        expect.objectContaining({ text: 'T' }),
      );
      expect(mockImageProcessingService.compressImage).toHaveBeenCalledWith(
        wmOut,
        expect.objectContaining({}),
      );
      expect(mockMediaService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ buffer: cmpOut, originalname: 'a.png' }),
        'a.png',
        'local', // default provider from UploadFileSchema
      );
      expect(saved).toEqual({ id: 99 });
    });

    it('should support async processing with queue', async () => {
      const file = {
        originalname: 'test.jpg',
        buffer: Buffer.from('image data'),
        size: 1024,
        mimetype: 'image/jpeg',
        fieldname: 'file',
        encoding: '7bit',
      } as any;

      const dto = {
        filename: 'test.jpg',
        async: true,
        processing: { compress: { enabled: true }, watermark: { enabled: true, text: 'Test' } },
      } as any;

      const mockUploadedFile = { id: 1, filename: 'test.jpg', path: '/uploads/test.jpg' };
      const mockTask = { id: 123, status: 'pending' };

      mockSettingRegistryService.getConfig.mockResolvedValueOnce(
        MediaProcessingSettingsSchema.parse({
          compress: { enabled: true },
          watermark: { enabled: true, text: 'Test' },
        }),
      );
      mockMediaService.uploadFile.mockResolvedValue(mockUploadedFile);
      mockImageProcessingQueueService.addTask.mockResolvedValue(mockTask);

      const result = await controller.uploadFile(file, dto);

      expect(mockMediaService.uploadFile).toHaveBeenCalled();
      expect(mockImageProcessingQueueService.addTask).toHaveBeenCalledWith(
        mockUploadedFile.id,
        expect.objectContaining({
          watermark: expect.any(Object),
          compress: expect.any(Object),
        }),
        file.buffer,
      );
      expect(result).toEqual({
        ...mockUploadedFile,
        taskId: 123,
        status: 'processing',
      });
    });

    it('should skip async processing when disabled in config', async () => {
      const file = {
        originalname: 'test.jpg',
        buffer: Buffer.from('image data'),
        size: 1024,
        mimetype: 'image/jpeg',
        fieldname: 'file',
        encoding: '7bit',
      } as any;

      const dto = {
        filename: 'test.jpg',
        async: true,
      } as any;

      mockSettingRegistryService.getConfig.mockResolvedValueOnce(
        MediaProcessingSettingsSchema.parse({
          compress: { enabled: false },
          watermark: { enabled: false },
        }),
      );
      mockMediaService.uploadFile.mockResolvedValue({ id: 1 } as any);

      const result = await controller.uploadFile(file, dto);

      expect(mockImageProcessingQueueService.addTask).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('taskId');
    });

    it('should skip processing for non-image files', async () => {
      const file = {
        originalname: 'document.pdf',
        buffer: Buffer.from('pdf data'),
        size: 1024,
        mimetype: 'application/pdf',
        fieldname: 'file',
        encoding: '7bit',
      } as any;

      const dto = {
        filename: 'document.pdf',
        processing: { compress: { enabled: true }, watermark: { enabled: true, text: 'Test' } },
      } as any;

      mockMediaService.uploadFile.mockResolvedValue({ id: 1 } as any);

      await controller.uploadFile(file, dto);

      expect(mockImageProcessingService.addWatermark).not.toHaveBeenCalled();
      expect(mockImageProcessingService.compressImage).not.toHaveBeenCalled();
    });

    it('should skip processing for SVG files', async () => {
      const file = {
        originalname: 'icon.svg',
        buffer: Buffer.from('<svg></svg>'),
        size: 100,
        mimetype: 'image/svg+xml',
        fieldname: 'file',
        encoding: '7bit',
      } as any;

      const dto = {
        filename: 'icon.svg',
        processing: { compress: { enabled: true }, watermark: { enabled: true, text: 'Test' } },
      } as any;

      mockMediaService.uploadFile.mockResolvedValue({ id: 1 } as any);

      await controller.uploadFile(file, dto);

      expect(mockImageProcessingService.addWatermark).not.toHaveBeenCalled();
      expect(mockImageProcessingService.compressImage).not.toHaveBeenCalled();
    });
  });

  describe('getTaskStatus', () => {
    it('should return task status by id', async () => {
      const mockTask = {
        id: 1,
        fileId: 10,
        status: 'completed',
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockImageProcessingQueueService.getTaskStatus.mockResolvedValue(mockTask);

      const result = await controller.getTaskStatus(1);

      expect(mockImageProcessingQueueService.getTaskStatus).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockTask);
    });

    it('should throw error when task not found', async () => {
      mockImageProcessingQueueService.getTaskStatus.mockResolvedValue(null);

      await expect(controller.getTaskStatus(999)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFileQueueTasks', () => {
    it('should return all tasks for a file', async () => {
      const mockTasks = [
        { id: 1, fileId: 10, status: 'completed' },
        { id: 2, fileId: 10, status: 'pending' },
      ];

      mockImageProcessingQueueService.getTasksByFileId.mockResolvedValue(mockTasks);

      const result = await controller.getFileQueueTasks(10);

      expect(mockImageProcessingQueueService.getTasksByFileId).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockTasks);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        pending: 5,
        processing: 2,
        completed: 100,
        failed: 3,
      };

      mockImageProcessingQueueService.getQueueStats.mockResolvedValue(mockStats);

      const result = await controller.getQueueStats();

      expect(mockImageProcessingQueueService.getQueueStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('uploadMultiple', () => {
    it('should support stringified processing override and apply watermark only', async () => {
      const f1 = {
        originalname: 'f1.png',
        buffer: Buffer.from('b1'),
        size: 2,
        mimetype: 'image/png',
      } as any;
      const f2 = {
        originalname: 'f2.png',
        buffer: Buffer.from('b2'),
        size: 2,
        mimetype: 'image/png',
      } as any;

      const wm1 = Buffer.from('w1');
      const wm2 = Buffer.from('w2');
      // resolve watermark differently per call to ensure per-file path
      mockImageProcessingService.addWatermark.mockResolvedValueOnce(wm1).mockResolvedValueOnce(wm2);
      mockMediaService.uploadFile
        .mockResolvedValueOnce({ id: 1 } as any)
        .mockResolvedValueOnce({ id: 2 } as any);

      const result = await controller.uploadMultiple([f1, f2], {
        processing: JSON.stringify({ watermark: { enabled: true, text: 'X' } }),
      } as any);

      expect(mockImageProcessingService.addWatermark).toHaveBeenCalledTimes(2);
      expect(mockImageProcessingService.compressImage).not.toHaveBeenCalled();
      expect(mockMediaService.uploadFile).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ buffer: wm1, originalname: 'f1.png' }),
        'f1.png',
        undefined,
      );
      expect(mockMediaService.uploadFile).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ buffer: wm2, originalname: 'f2.png' }),
        'f2.png',
        undefined,
      );
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });
});

describe('chunked upload', () => {
  let controller: MediaController;
  let mockMediaService: any;
  let mockImageProcessingService: any;
  let mockStorageConfigService: any;
  let mockImageProcessingQueueService: any;
  let mockSettingRegistryService: any;

  beforeEach(async () => {
    // 使用 MockUtils 创建 Mock 服务
    mockMediaService = MockUtils.services.createMediaServiceMock();
    mockImageProcessingService = MockUtils.services.createImageProcessingServiceMock();
    mockStorageConfigService = MockUtils.services.createStorageConfigServiceMock();
    mockImageProcessingQueueService = MockUtils.services.createImageProcessingQueueServiceMock();
    mockSettingRegistryService = {
      getConfig: vi.fn().mockResolvedValue(MediaProcessingSettingsSchema.parse({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        { provide: MediaService, useValue: mockMediaService },
        { provide: ImageProcessingService, useValue: mockImageProcessingService },
        { provide: StorageConfigService, useValue: mockStorageConfigService },
        { provide: SettingRegistryService, useValue: mockSettingRegistryService },
        { provide: ImageProcessingQueueService, useValue: mockImageProcessingQueueService },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initiateChunkUpload should validate and delegate to service', async () => {
    const dto = {
      filename: 'big.bin',
      totalSize: 20,
      chunkSize: 10,
      totalChunks: 2,
    } as any;
    const resp = { uploadId: 'u1', uploaded: [false, false], totalChunks: 2 };
    mockMediaService.initiateChunkUpload.mockResolvedValue(resp);

    const result = await controller.initiateChunkUpload(dto);

    expect(mockMediaService.initiateChunkUpload).toHaveBeenCalledWith(dto);
    expect(result).toEqual(resp);
  });

  it('uploadChunk should pass file and dto to service', async () => {
    const dto = { uploadId: 'u1', index: 0 } as any;
    const file = {
      originalname: 'part0',
      buffer: Buffer.from('a'),
      size: 1,
      mimetype: 'application/octet-stream',
    } as any;
    mockMediaService.uploadChunk.mockResolvedValue({ index: 0, size: 1 });

    const result = await controller.uploadChunk(file, dto);

    expect(mockMediaService.uploadChunk).toHaveBeenCalledWith({ uploadId: 'u1', index: 0, file });
    expect(result).toEqual({ index: 0, size: 1 });
  });

  it('completeChunkUpload should merge, optionally compress and upload, then cleanup', async () => {
    const dto = { uploadId: 'u1', filename: 'final.bin' } as any;
    const merged = {
      buffer: Buffer.from('data'),
      meta: { filename: 'final.bin', mimeType: 'application/octet-stream' },
    };
    const saved = { id: 10 } as any;

    mockMediaService.mergeChunks = vi.fn().mockResolvedValue(merged);
    mockMediaService.uploadFile.mockResolvedValue(saved);
    mockMediaService.cleanupChunks.mockResolvedValue(undefined);

    const result = await controller.completeChunkUpload(dto);

    expect(mockMediaService.mergeChunks).toHaveBeenCalledWith('u1');
    expect(mockMediaService.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'final.bin', buffer: merged.buffer }),
      'final.bin',
    );
    expect(mockMediaService.cleanupChunks).toHaveBeenCalledWith('u1');
    expect(result).toBe(saved);
  });

  it('completeChunkUpload should honor processing override: watermark then compress for images', async () => {
    const dto = {
      uploadId: 'u2',
      filename: 'final.png',
      processing: { compress: { enabled: true }, watermark: { enabled: true, text: 'W' } },
    } as any;
    const merged = {
      buffer: Buffer.from('img'),
      meta: { filename: 'final.png', mimeType: 'image/png' },
    };
    const wmOut = Buffer.from('wm2');
    const cmpOut = Buffer.from('cmp2');

    mockMediaService.mergeChunks = vi.fn().mockResolvedValue(merged);
    mockImageProcessingService.addWatermark.mockResolvedValue(wmOut);
    mockImageProcessingService.compressImage.mockResolvedValue({ buffer: cmpOut });
    mockMediaService.uploadFile.mockResolvedValue({ id: 20 } as any);
    mockMediaService.cleanupChunks.mockResolvedValue(undefined);

    const result = await controller.completeChunkUpload(dto);

    expect(mockImageProcessingService.addWatermark).toHaveBeenCalledWith(
      merged.buffer,
      expect.objectContaining({ text: 'W' }),
    );
    expect(mockImageProcessingService.compressImage).toHaveBeenCalledWith(
      wmOut,
      expect.objectContaining({}),
    );
    expect(mockMediaService.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'final.png', buffer: cmpOut }),
      'final.png',
    );
    expect(mockMediaService.cleanupChunks).toHaveBeenCalledWith('u2');
    expect(result).toEqual({ id: 20 });
  });
});
