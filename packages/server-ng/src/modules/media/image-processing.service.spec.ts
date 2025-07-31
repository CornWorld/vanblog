import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageProcessingService } from './services/image-processing.service';

const mockSharp = {
  metadata: vi.fn(),
  resize: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  composite: vi.fn().mockReturnThis(),
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
      mockSharp.toBuffer.mockResolvedValue(outputBuffer);

      const result = await service.compressImage(inputBuffer);

      expect(result).toBe(outputBuffer);
      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 80 });
    });

    it('should resize image if width exceeds maxWidth', async () => {
      const inputBuffer = Buffer.from('test image');

      mockSharp.metadata.mockResolvedValue({
        width: 3000,
        height: 2000,
        format: 'jpeg',
      });
      mockSharp.toBuffer.mockResolvedValue(Buffer.from('resized'));

      await service.compressImage(inputBuffer, { maxWidth: 1920 });

      expect(mockSharp.resize).toHaveBeenCalledWith(1920, null, {
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
      mockSharp.toBuffer.mockResolvedValue(Buffer.from('compressed'));

      await service.compressImage(inputBuffer, { quality: 90 });

      expect(mockSharp.png).toHaveBeenCalledWith({ quality: 90 });
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
