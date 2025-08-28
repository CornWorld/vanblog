import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { SettingRegistryService } from '../setting/services/setting-registry.service';

import { MediaProcessingSettingsSchema } from './dto/media-settings.dto';
import { MediaController } from './media.controller';
import { ImageProcessingService } from './services/image-processing.service';
import { MediaService } from './services/media.service';
import { StorageConfigService } from './services/storage-config.service';

const mockSettingRegistryService = {
  getConfig: vi.fn().mockResolvedValue(MediaProcessingSettingsSchema.parse({})),
};

const mockMediaService = {
  uploadFile: vi.fn(),
  listFiles: vi.fn(),
  getFileById: vi.fn(),
  deleteFile: vi.fn(),
  deleteFiles: vi.fn(),
  scanArticleImages: vi.fn(),
  exportAllImages: vi.fn(),
  // chunked upload methods
  initiateChunkUpload: vi.fn(),
  uploadChunk: vi.fn(),
  mergeChunks: vi.fn(),
  cleanupChunks: vi.fn(),
};

const mockImageProcessingService = {
  compressImage: vi.fn(),
  addWatermark: vi.fn(),
};

const mockStorageConfigService = {
  getStorageConfig: vi.fn(),
  updateStorageConfig: vi.fn(),
};

const mockJwtAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };
const mockPermissionsGuard = { canActivate: vi.fn().mockReturnValue(true) };

describe('MediaController', () => {
  let controller: MediaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        { provide: MediaService, useValue: mockMediaService },
        { provide: ImageProcessingService, useValue: mockImageProcessingService },
        { provide: StorageConfigService, useValue: mockStorageConfigService },
        { provide: SettingRegistryService, useValue: mockSettingRegistryService },
      ],
    })
      .overrideGuard(PermissionsGuard)
      .useValue(mockPermissionsGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

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
      expect(mockStorageConfigService.updateStorageConfig).toHaveBeenCalledWith(dto);
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
        undefined,
      );
      expect(saved).toEqual({ id: 99 });
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        { provide: MediaService, useValue: mockMediaService },
        { provide: ImageProcessingService, useValue: mockImageProcessingService },
        { provide: StorageConfigService, useValue: mockStorageConfigService },
        { provide: SettingRegistryService, useValue: mockSettingRegistryService },
      ],
    })
      .overrideGuard(PermissionsGuard)
      .useValue(mockPermissionsGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

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
