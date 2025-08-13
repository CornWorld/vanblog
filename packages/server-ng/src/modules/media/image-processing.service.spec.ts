import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ImageProcessingService } from './services/image-processing.service';

const mockSharp = {
  metadata: vi.fn(),
  resize: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  composite: vi.fn().mockReturnThis(),
  keepMetadata: vi.fn().mockReturnThis(),
  toBuffer: vi.fn(),
};

vi.mock('sharp', () => {
  const sharp = vi.fn(() => mockSharp);
  return { default: sharp };
});

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(() => {
    service = new ImageProcessingService();
    vi.clearAllMocks();
  });

  describe('compressImage', () => {
    it('should compress JPEG image with default quality', async () => {
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
        },
      });

      const result = await service.compressImage(inputBuffer, { format: 'jpeg' });

      expect(result.buffer).toBe(outputBuffer);
      expect(result.metadata.width).toBe(800);
      expect(result.metadata.height).toBe(600);
      expect(result.metadata.format).toBe('jpeg');
      expect(mockSharp.jpeg).toHaveBeenCalledWith({
        quality: 80,
        progressive: true,
        mozjpeg: true,
        trellisQuantisation: true,
        overshootDeringing: true,
        optimizeScans: true,
      });
    });

    it('should resize image if width exceeds maxWidth', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: 3000,
        height: 2000,
        format: 'jpeg',
      });
      const resizedBuffer = Buffer.from('resized');
      mockSharp.toBuffer.mockResolvedValue({
        data: resizedBuffer,
        info: {
          width: 1920,
          height: 1280,
          format: 'jpeg',
          size: resizedBuffer.length,
        },
      });

      await service.compressImage(inputBuffer, { maxWidth: 1920 });

      expect(mockSharp.resize).toHaveBeenCalledWith(1920, 1080, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    });

    it('should handle PNG format', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'png',
      });
      const compressedBuffer = Buffer.from('compressed');
      mockSharp.toBuffer.mockResolvedValue({
        data: compressedBuffer,
        info: {
          width: 800,
          height: 600,
          format: 'png',
          size: compressedBuffer.length,
        },
      });

      await service.compressImage(inputBuffer, { quality: 90, format: 'png' });

      expect(mockSharp.png).toHaveBeenCalledWith({
        quality: 90,
        progressive: true,
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
      });
    });
  });

  describe('addWatermark', () => {
    it('should add text watermark', async () => {
      const inputBuffer = Buffer.from('test image');
      const outputBuffer = Buffer.from('watermarked image');

      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
      });
      mockSharp.toBuffer.mockResolvedValue(outputBuffer);

      const result = await service.addWatermark(inputBuffer, {
        text: 'Copyright',
        position: 'center',
        opacity: 0.5,
      });

      expect(result).toBe(outputBuffer);
      expect(mockSharp.composite).toHaveBeenCalled();
    });

    it('should return original buffer if no watermark specified', async () => {
      const inputBuffer = Buffer.from('test image');

      const result = await service.addWatermark(inputBuffer, undefined);

      expect(result).toBe(inputBuffer);
      expect(mockSharp.composite).not.toHaveBeenCalled();
    });

    it('should handle invalid metadata', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: undefined,
        height: undefined,
      });

      const result = await service.addWatermark(inputBuffer, {
        text: 'Test',
      });

      expect(result).toBe(inputBuffer);
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

      await service.generateThumbnail(inputBuffer, 300);

      expect(mockSharp.resize).toHaveBeenCalledWith(300, 300, {
        fit: 'cover',
        position: 'center',
      });
    });
  });

  describe('getImageMetadata', () => {
    it('should return image metadata', async () => {
      const inputBuffer = Buffer.from('test image');
      const mockMetadata = {
        width: 1920,
        height: 1080,
        format: 'jpeg',
        size: 1024,
        density: 72,
        hasAlpha: false,
        orientation: 1,
      };

      mockSharp.metadata.mockResolvedValue(mockMetadata);

      const result = await service.getImageMetadata(inputBuffer);

      expect(result).toEqual(mockMetadata);
    });
  });
});
