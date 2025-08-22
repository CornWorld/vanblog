import { promises as fsPromises } from 'fs';
import { join } from 'path';

import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

import { LocalStorageService } from './local-storage.service';

// Mock fs promises
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('test file content'),
    destination: '',
    filename: '',
    path: '',
    stream: {} as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalStorageService],
    }).compile();

    service = module.get<LocalStorageService>(LocalStorageService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('should upload file successfully', async () => {
      const filename = 'test-image.jpg';
      const expectedPath = join(process.cwd(), 'uploads', 'images', filename);
      const expectedUrl = `/uploads/images/${filename}`;

      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const result = await service.upload(mockFile, filename);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(join(process.cwd(), 'uploads', 'images'), {
        recursive: true,
      });
      expect(fsPromises.writeFile).toHaveBeenCalledWith(expectedPath, mockFile.buffer);
      expect(result).toEqual({
        url: expectedUrl,
        filename,
        size: mockFile.buffer.length,
        mimeType: mockFile.mimetype,
      });
    });

    it('should handle mkdir errors gracefully', async () => {
      const filename = 'test-image.jpg';
      const mkdirError = new Error('Permission denied');

      vi.mocked(fsPromises.mkdir).mockRejectedValue(mkdirError);

      await expect(service.upload(mockFile, filename)).rejects.toThrow('Permission denied');
    });

    it('should handle writeFile errors gracefully', async () => {
      const filename = 'test-image.jpg';
      const writeError = new Error('Disk full');

      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.writeFile).mockRejectedValue(writeError);

      await expect(service.upload(mockFile, filename)).rejects.toThrow('Disk full');
    });
  });

  describe('delete', () => {
    it('should delete file successfully', async () => {
      const filename = 'test-image.jpg';
      const expectedPath = join(process.cwd(), 'uploads', 'images', filename);

      vi.mocked(fsPromises.unlink).mockResolvedValue(undefined);

      const result = await service.delete(filename);

      expect(fsPromises.unlink).toHaveBeenCalledWith(expectedPath);
      expect(result).toBe(true);
    });

    it('should return false when file deletion fails', async () => {
      const filename = 'non-existent.jpg';
      const unlinkError = new Error('File not found');

      vi.mocked(fsPromises.unlink).mockRejectedValue(unlinkError);

      const result = await service.delete(filename);

      expect(result).toBe(false);
    });
  });

  describe('getUrl', () => {
    it('should return correct URL for filename', () => {
      const filename = 'test-image.jpg';
      const expectedUrl = `/uploads/images/${filename}`;

      const result = service.getUrl(filename);

      expect(result).toBe(expectedUrl);
    });

    it('should handle filenames with special characters', () => {
      const filename = 'test image with spaces.jpg';
      const expectedUrl = `/uploads/images/${filename}`;

      const result = service.getUrl(filename);

      expect(result).toBe(expectedUrl);
    });

    it('should handle empty filename', () => {
      const filename = '';
      const expectedUrl = '/uploads/images/';

      const result = service.getUrl(filename);

      expect(result).toBe(expectedUrl);
    });
  });
});
