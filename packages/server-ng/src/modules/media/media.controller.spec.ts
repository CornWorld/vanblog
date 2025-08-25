import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import { MediaController } from './media.controller';
import { ImageProcessingService } from './services/image-processing.service';
import { MediaService } from './services/media.service';
import { StorageConfigService } from './services/storage-config.service';

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
});
