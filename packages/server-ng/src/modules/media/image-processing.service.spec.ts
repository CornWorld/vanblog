import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fsPromises } from 'fs';

import { ImageProcessingService } from './services/image-processing.service';

import type { FormatEnum } from 'sharp';

// Mock sharp module
const mockSharp = {
  metadata: vi.fn(),
  resize: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  avif: vi.fn().mockReturnThis(),
  composite: vi.fn().mockReturnThis(),
  keepMetadata: vi.fn().mockReturnThis(),
  toBuffer: vi.fn(),
};

vi.mock('sharp', () => {
  const sharp = vi.fn(() => mockSharp);
  return { default: sharp };
});

// Mock fs/promises
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(() => {
    service = new ImageProcessingService();
    vi.clearAllMocks();
  });

  describe('compressImage', () => {
    it('should compress JPEG image with default options', async () => {
      const inputBuffer = Buffer.from('test image');
      const outputBuffer = Buffer.from('compressed image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: outputBuffer,
        info: {
          width: 800,
          height: 600,
          format: 'jpeg',
          size: outputBuffer.length,
          channels: 3,
        },
      });

      const result = await service.compressImage(inputBuffer, { format: 'jpeg' });

      expect(result.buffer).toBe(outputBuffer);
      expect(result.metadata.width).toBe(800);
      expect(result.metadata.height).toBe(600);
      expect(result.metadata.format).toBe('jpeg');
      expect(result.originalSize).toBe(inputBuffer.length);
      expect(result.compressedSize).toBe(outputBuffer.length);
      expect(mockSharp.jpeg).toHaveBeenCalledWith({
        quality: 80,
        progressive: true,
        mozjpeg: true,
        trellisQuantisation: true,
        overshootDeringing: true,
        optimizeScans: true,
      });
    });

    it('should compress PNG image with custom quality', async () => {
      const inputBuffer = Buffer.from('test image');
      const outputBuffer = Buffer.from('compressed');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'png',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: outputBuffer,
        info: {
          width: 800,
          height: 600,
          format: 'png',
          size: outputBuffer.length,
          channels: 4,
        },
      });

      const result = await service.compressImage(inputBuffer, { quality: 90, format: 'png' });

      expect(result.buffer).toBe(outputBuffer);
      expect(result.metadata.hasAlpha).toBe(true);
      expect(mockSharp.png).toHaveBeenCalledWith({
        quality: 90,
        progressive: true,
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
      });
    });

    it('should compress WebP image with optimizations', async () => {
      const inputBuffer = Buffer.from('test image');
      const outputBuffer = Buffer.from('compressed');

      mockSharp.metadata.mockResolvedValue({
        width: 1200,
        height: 900,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: outputBuffer,
        info: {
          width: 1200,
          height: 900,
          format: 'webp',
          size: outputBuffer.length,
          channels: 3,
        },
      });

      await service.compressImage(inputBuffer, {
        format: 'webp',
        quality: 85,
        optimizeForWeb: true,
      });

      expect(mockSharp.webp).toHaveBeenCalledWith({
        quality: 85,
        effort: 6,
        lossless: false,
        nearLossless: false,
        smartSubsample: true,
      });
    });

    it('should compress AVIF image with high effort', async () => {
      const inputBuffer = Buffer.from('test image');
      const outputBuffer = Buffer.from('compressed');

      mockSharp.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: outputBuffer,
        info: {
          width: 1920,
          height: 1080,
          format: 'avif',
          size: outputBuffer.length,
          channels: 3,
        },
      });

      await service.compressImage(inputBuffer, {
        format: 'avif',
        quality: 70,
        optimizeForWeb: true,
      });

      expect(mockSharp.avif).toHaveBeenCalledWith({
        quality: 70,
        effort: 9,
        lossless: false,
      });
    });

    it('should resize image when width exceeds maxWidth', async () => {
      const inputBuffer = Buffer.from('large image');
      const outputBuffer = Buffer.from('resized');

      mockSharp.metadata.mockResolvedValue({
        width: 3000,
        height: 2000,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: outputBuffer,
        info: {
          width: 1920,
          height: 1280,
          format: 'jpeg',
          size: outputBuffer.length,
          channels: 3,
        },
      });

      await service.compressImage(inputBuffer, { maxWidth: 1920 });

      expect(mockSharp.resize).toHaveBeenCalledWith(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    });

    it('should resize image when height exceeds maxHeight', async () => {
      const inputBuffer = Buffer.from('large image');

      mockSharp.metadata.mockResolvedValue({
        width: 1500,
        height: 3000,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: Buffer.from('resized'),
        info: {
          width: 540,
          height: 1080,
          format: 'jpeg',
          size: 100,
          channels: 3,
        },
      });

      await service.compressImage(inputBuffer, { maxHeight: 1080 });

      expect(mockSharp.resize).toHaveBeenCalledWith(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    });

    it('should use custom fit mode', async () => {
      const inputBuffer = Buffer.from('image');

      mockSharp.metadata.mockResolvedValue({
        width: 2000,
        height: 1500,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: Buffer.from('fitted'),
        info: {
          width: 1920,
          height: 1080,
          format: 'jpeg',
          size: 100,
          channels: 3,
        },
      });

      await service.compressImage(inputBuffer, {
        maxWidth: 1920,
        maxHeight: 1080,
        fit: 'cover',
      });

      expect(mockSharp.resize).toHaveBeenCalledWith(1920, 1080, {
        fit: 'cover',
        withoutEnlargement: true,
      });
    });

    it('should keep metadata when removeMetadata is false', async () => {
      const inputBuffer = Buffer.from('image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: Buffer.from('output'),
        info: {
          width: 800,
          height: 600,
          format: 'jpeg',
          size: 100,
          channels: 3,
        },
      });

      await service.compressImage(inputBuffer, {
        removeMetadata: false,
        format: 'jpeg',
      });

      expect(mockSharp.keepMetadata).toHaveBeenCalled();
    });

    it('should not resize small images', async () => {
      const inputBuffer = Buffer.from('small image');

      mockSharp.metadata.mockResolvedValue({
        width: 500,
        height: 400,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: Buffer.from('output'),
        info: {
          width: 500,
          height: 400,
          format: 'jpeg',
          size: 100,
          channels: 3,
        },
      });

      await service.compressImage(inputBuffer, {
        maxWidth: 1920,
        maxHeight: 1080,
      });

      expect(mockSharp.resize).not.toHaveBeenCalled();
    });

    it('should auto-select WebP format for images with alpha channel', async () => {
      const inputBuffer = Buffer.from('png with alpha');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'png' as keyof FormatEnum,
        hasAlpha: true,
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: Buffer.from('output'),
        info: {
          width: 800,
          height: 600,
          format: 'webp',
          size: 100,
          channels: 4,
        },
      });

      await service.compressImage(inputBuffer, { format: 'auto' });

      expect(mockSharp.webp).toHaveBeenCalled();
    });

    it('should auto-select WebP format for high-density images', async () => {
      const inputBuffer = Buffer.from('high density image');

      mockSharp.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg' as keyof FormatEnum,
        density: 300,
        hasAlpha: false,
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: Buffer.from('output'),
        info: {
          width: 1920,
          height: 1080,
          format: 'webp',
          size: 100,
          channels: 3,
        },
      });

      await service.compressImage(inputBuffer, { format: 'auto' });

      expect(mockSharp.webp).toHaveBeenCalled();
    });

    it('should auto-select WebP format by default', async () => {
      const inputBuffer = Buffer.from('normal image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'jpeg' as keyof FormatEnum,
        density: 72,
        hasAlpha: false,
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: Buffer.from('output'),
        info: {
          width: 800,
          height: 600,
          format: 'webp',
          size: 100,
          channels: 3,
        },
      });

      await service.compressImage(inputBuffer, { format: 'auto' });

      expect(mockSharp.webp).toHaveBeenCalled();
    });

    it('should calculate compression ratio correctly', async () => {
      const inputBuffer = Buffer.from('a'.repeat(10000));
      const outputBuffer = Buffer.from('b'.repeat(3000));

      mockSharp.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: outputBuffer,
        info: {
          width: 1920,
          height: 1080,
          format: 'jpeg',
          size: outputBuffer.length,
          channels: 3,
        },
      });

      const result = await service.compressImage(inputBuffer);

      expect(result.compressionRatio).toBe(70); // (1 - 3000/10000) * 100 = 70
    });

    it('should handle zero original size gracefully', async () => {
      const inputBuffer = Buffer.from('');
      const outputBuffer = Buffer.from('output');

      mockSharp.metadata.mockResolvedValue({
        width: 100,
        height: 100,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: outputBuffer,
        info: {
          width: 100,
          height: 100,
          format: 'jpeg',
          size: outputBuffer.length,
          channels: 3,
        },
      });

      const result = await service.compressImage(inputBuffer);

      expect(result.compressionRatio).toBe(0);
    });

    it('should disable optimization when optimizeForWeb is false', async () => {
      const inputBuffer = Buffer.from('image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue({
        data: Buffer.from('output'),
        info: {
          width: 800,
          height: 600,
          format: 'webp',
          size: 100,
          channels: 3,
        },
      });

      await service.compressImage(inputBuffer, {
        format: 'webp',
        optimizeForWeb: false,
      });

      expect(mockSharp.webp).toHaveBeenCalledWith({
        quality: 80,
        effort: 4,
        lossless: false,
        nearLossless: false,
        smartSubsample: false,
      });
    });
  });

  describe('addWatermark', () => {
    it('should add text watermark to center', async () => {
      const inputBuffer = Buffer.from('test image');
      const outputBuffer = Buffer.from('watermarked image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });
      mockSharp.toBuffer.mockResolvedValue(outputBuffer);

      const result = await service.addWatermark(inputBuffer, {
        text: 'Copyright 2025',
        position: 'center',
        opacity: 0.5,
      });

      expect(result).toBe(outputBuffer);
      expect(mockSharp.composite).toHaveBeenCalled();
      const [[compositeCall]] = mockSharp.composite.mock.calls;
      expect(compositeCall[0].gravity).toBe('center');
    });

    it('should add text watermark to different positions', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });
      mockSharp.toBuffer.mockResolvedValue(Buffer.from('output'));

      const positions = ['northwest', 'northeast', 'southwest', 'southeast'] as const;

      for (const position of positions) {
        vi.clearAllMocks();
        await service.addWatermark(inputBuffer, {
          text: 'Test',
          position,
        });

        const [[compositeCall]] = mockSharp.composite.mock.calls;
        expect(compositeCall[0].gravity).toBe(position);
      }
    });

    it('should use default opacity when not specified', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });
      mockSharp.toBuffer.mockResolvedValue(Buffer.from('output'));

      await service.addWatermark(inputBuffer, {
        text: 'Watermark',
      });

      expect(mockSharp.composite).toHaveBeenCalled();
    });

    it('should add image watermark from file', async () => {
      const inputBuffer = Buffer.from('test image');
      const watermarkBuffer = Buffer.from('watermark');
      const outputBuffer = Buffer.from('result');

      mockSharp.metadata
        .mockResolvedValueOnce({
          width: 800,
          height: 600,
        })
        .mockResolvedValueOnce({
          width: 200,
          height: 150,
        });

      mockSharp.toBuffer.mockResolvedValueOnce(watermarkBuffer).mockResolvedValueOnce(outputBuffer);

      vi.mocked(fsPromises.readFile).mockResolvedValue(watermarkBuffer);

      const result = await service.addWatermark(inputBuffer, {
        imagePath: '/path/to/watermark.png',
        position: 'southeast',
      });

      expect(result).toBe(outputBuffer);
      expect(fsPromises.readFile).toHaveBeenCalledWith('/path/to/watermark.png');
      expect(mockSharp.composite).toHaveBeenCalled();
    });

    it('should resize large watermark image', async () => {
      const inputBuffer = Buffer.from('test image');
      const watermarkBuffer = Buffer.from('large watermark');

      mockSharp.metadata
        .mockResolvedValueOnce({
          width: 1000,
          height: 800,
        })
        .mockResolvedValueOnce({
          width: 500,
          height: 400,
        });

      mockSharp.toBuffer.mockResolvedValue(Buffer.from('resized'));

      vi.mocked(fsPromises.readFile).mockResolvedValue(watermarkBuffer);

      await service.addWatermark(inputBuffer, {
        imagePath: '/path/to/watermark.png',
      });

      expect(mockSharp.resize).toHaveBeenCalledWith(300, 240, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    });

    it('should return original buffer when no watermark specified', async () => {
      const inputBuffer = Buffer.from('test image');

      const result = await service.addWatermark(inputBuffer, undefined);

      expect(result).toBe(inputBuffer);
      expect(mockSharp.composite).not.toHaveBeenCalled();
    });

    it('should return original buffer when watermark object is empty', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });

      const result = await service.addWatermark(inputBuffer, {});

      expect(result).toBe(inputBuffer);
    });

    it('should return original buffer when metadata is invalid', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: undefined,
        height: undefined,
      });

      const result = await service.addWatermark(inputBuffer, {
        text: 'Test',
      });

      expect(result).toBe(inputBuffer);
      expect(mockSharp.composite).not.toHaveBeenCalled();
    });

    it('should return original buffer when watermark image file read fails', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });

      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('File not found'));

      const result = await service.addWatermark(inputBuffer, {
        imagePath: '/nonexistent/watermark.png',
      });

      expect(result).toBe(inputBuffer);
    });

    it('should return original buffer when watermark image metadata is invalid', async () => {
      const inputBuffer = Buffer.from('test image');
      const watermarkBuffer = Buffer.from('watermark');

      mockSharp.metadata
        .mockResolvedValueOnce({
          width: 800,
          height: 600,
        })
        .mockResolvedValueOnce({
          width: undefined,
          height: undefined,
        });

      vi.mocked(fsPromises.readFile).mockResolvedValue(watermarkBuffer);

      const result = await service.addWatermark(inputBuffer, {
        imagePath: '/path/to/watermark.png',
      });

      expect(result).toBe(inputBuffer);
    });

    it('should default to center gravity when position is undefined', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });
      mockSharp.toBuffer.mockResolvedValue(Buffer.from('output'));

      await service.addWatermark(inputBuffer, {
        text: 'Test',
        position: undefined,
      });

      const [[compositeCall]] = mockSharp.composite.mock.calls;
      expect(compositeCall[0].gravity).toBe('center');
    });
  });

  describe('addWatermark - comprehensive file error handling tests', () => {
    it('should handle ENOENT (file not found) errors gracefully', async () => {
      const inputBuffer = Buffer.from('test image');
      const enoentError = new Error('ENOENT: no such file or directory');
      (enoentError as any).code = 'ENOENT';

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });

      vi.mocked(fsPromises.readFile).mockRejectedValue(enoentError);

      const result = await service.addWatermark(inputBuffer, {
        imagePath: '/nonexistent/watermark.png',
      });

      // Should return original buffer without throwing
      expect(result).toBe(inputBuffer);
      expect(mockSharp.composite).not.toHaveBeenCalled();
    });

    it('should handle EACCES (permission denied) errors gracefully', async () => {
      const inputBuffer = Buffer.from('test image');
      const eacces = new Error('EACCES: permission denied');
      (eacces as any).code = 'EACCES';

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });

      vi.mocked(fsPromises.readFile).mockRejectedValue(eacces);

      const result = await service.addWatermark(inputBuffer, {
        imagePath: '/protected/watermark.png',
      });

      // Should return original buffer without throwing
      expect(result).toBe(inputBuffer);
      expect(mockSharp.composite).not.toHaveBeenCalled();
    });

    it('should handle invalid path characters in watermark file path', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });

      // Simulate error with invalid path
      const invalidPathError = new Error('Invalid argument');
      vi.mocked(fsPromises.readFile).mockRejectedValue(invalidPathError);

      const result = await service.addWatermark(inputBuffer, {
        imagePath: '/invalid\x00path/watermark.png',
      });

      expect(result).toBe(inputBuffer);
      expect(mockSharp.composite).not.toHaveBeenCalled();
    });

    it('should provide descriptive logging for file errors', async () => {
      const inputBuffer = Buffer.from('test image');
      vi.spyOn(service as any, 'logger' as any, 'get').mockReturnValue({
        error: vi.fn(),
        warn: vi.fn(),
        log: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
        info: vi.fn(),
      });

      const enoentError = new Error('ENOENT: no such file or directory');
      (enoentError as any).code = 'ENOENT';

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });

      vi.mocked(fsPromises.readFile).mockRejectedValue(enoentError);

      await service.addWatermark(inputBuffer, {
        imagePath: '/missing/watermark.png',
      });

      // Verify service handles error (may or may not log, but shouldn't crash)
      expect(mockSharp.composite).not.toHaveBeenCalled();
    });

    it('should not crash when watermark file exists but is corrupted at read time', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });

      // Simulate read error for corrupted file
      const corruptedError = new Error('Unexpected end of file');
      vi.mocked(fsPromises.readFile).mockRejectedValue(corruptedError);

      const result = await service.addWatermark(inputBuffer, {
        imagePath: '/path/to/corrupted.png',
      });

      // Should gracefully fall back to original buffer on read error
      expect(result).toBe(inputBuffer);
    });

    it('should handle concurrent file read errors for multiple watermark operations', async () => {
      const inputBuffer1 = Buffer.from('image 1');
      const inputBuffer2 = Buffer.from('image 2');

      const enoentError = new Error('ENOENT: no such file or directory');
      (enoentError as any).code = 'ENOENT';

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });

      vi.mocked(fsPromises.readFile).mockRejectedValue(enoentError);

      const result1 = await service.addWatermark(inputBuffer1, {
        imagePath: '/missing/wm1.png',
      });

      const result2 = await service.addWatermark(inputBuffer2, {
        imagePath: '/missing/wm2.png',
      });

      // Both should return original buffers
      expect(result1).toBe(inputBuffer1);
      expect(result2).toBe(inputBuffer2);
    });
  });

  describe('getImageMetadata', () => {
    it('should return image metadata', async () => {
      const inputBuffer = Buffer.from('test image');
      const mockMetadata = {
        width: 1920,
        height: 1080,
        format: 'jpeg',
        size: 1024000,
        density: 72,
        hasAlpha: false,
        orientation: 1,
      };

      mockSharp.metadata.mockResolvedValue(mockMetadata);

      const result = await service.getImageMetadata(inputBuffer);

      expect(result).toEqual(mockMetadata);
    });

    it('should handle metadata with alpha channel', async () => {
      const inputBuffer = Buffer.from('png image');
      const mockMetadata = {
        width: 800,
        height: 600,
        format: 'png',
        size: 512000,
        density: 96,
        hasAlpha: true,
        orientation: 1,
      };

      mockSharp.metadata.mockResolvedValue(mockMetadata);

      const result = await service.getImageMetadata(inputBuffer);

      expect(result.hasAlpha).toBe(true);
      expect(result.format).toBe('png');
    });

    it('should handle metadata with different orientations', async () => {
      const inputBuffer = Buffer.from('rotated image');

      mockSharp.metadata.mockResolvedValue({
        width: 600,
        height: 800,
        format: 'jpeg',
        orientation: 6, // 90° clockwise
      });

      const result = await service.getImageMetadata(inputBuffer);

      expect(result.orientation).toBe(6);
    });

    it('should handle partial metadata', async () => {
      const inputBuffer = Buffer.from('image');

      mockSharp.metadata.mockResolvedValue({
        width: 100,
        height: 100,
      });

      const result = await service.getImageMetadata(inputBuffer);

      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(result.format).toBeUndefined();
      expect(result.size).toBeUndefined();
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail with default size', async () => {
      const inputBuffer = Buffer.from('test image');
      const thumbnailBuffer = Buffer.from('thumbnail');

      mockSharp.toBuffer.mockResolvedValue(thumbnailBuffer);

      const result = await service.generateThumbnail(inputBuffer);

      expect(result).toBe(thumbnailBuffer);
      expect(mockSharp.resize).toHaveBeenCalledWith(200, 200, {
        fit: 'cover',
        position: 'center',
      });
    });

    it('should generate thumbnail with custom size', async () => {
      const inputBuffer = Buffer.from('test image');
      const thumbnailBuffer = Buffer.from('thumbnail');

      mockSharp.toBuffer.mockResolvedValue(thumbnailBuffer);

      const result = await service.generateThumbnail(inputBuffer, 300);

      expect(result).toBe(thumbnailBuffer);
      expect(mockSharp.resize).toHaveBeenCalledWith(300, 300, {
        fit: 'cover',
        position: 'center',
      });
    });

    it('should generate small thumbnail', async () => {
      const inputBuffer = Buffer.from('test image');
      const thumbnailBuffer = Buffer.from('small thumbnail');

      mockSharp.toBuffer.mockResolvedValue(thumbnailBuffer);

      const result = await service.generateThumbnail(inputBuffer, 100);

      expect(result).toBe(thumbnailBuffer);
      expect(mockSharp.resize).toHaveBeenCalledWith(100, 100, {
        fit: 'cover',
        position: 'center',
      });
    });

    it('should generate large thumbnail', async () => {
      const inputBuffer = Buffer.from('test image');
      const thumbnailBuffer = Buffer.from('large thumbnail');

      mockSharp.toBuffer.mockResolvedValue(thumbnailBuffer);

      const result = await service.generateThumbnail(inputBuffer, 500);

      expect(result).toBe(thumbnailBuffer);
      expect(mockSharp.resize).toHaveBeenCalledWith(500, 500, {
        fit: 'cover',
        position: 'center',
      });
    });
  });

  describe('error handling', () => {
    it('should propagate sharp errors in compressImage', async () => {
      const inputBuffer = Buffer.from('invalid image');
      const error = new Error('Invalid image format');

      mockSharp.metadata.mockRejectedValue(error);

      await expect(service.compressImage(inputBuffer)).rejects.toThrow('Invalid image format');
    });

    it('should propagate sharp errors in getImageMetadata', async () => {
      const inputBuffer = Buffer.from('corrupted image');
      const error = new Error('Cannot read metadata');

      mockSharp.metadata.mockRejectedValue(error);

      await expect(service.getImageMetadata(inputBuffer)).rejects.toThrow('Cannot read metadata');
    });

    it('should propagate sharp errors in generateThumbnail', async () => {
      const inputBuffer = Buffer.from('bad image');
      const error = new Error('Processing failed');

      mockSharp.toBuffer.mockRejectedValue(error);

      await expect(service.generateThumbnail(inputBuffer)).rejects.toThrow('Processing failed');
    });
  });
});
