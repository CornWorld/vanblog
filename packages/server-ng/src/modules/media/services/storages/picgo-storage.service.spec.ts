import { createHash } from 'crypto';
import { promises as fsPromises } from 'fs';
import { join } from 'path';

import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

import { PicgoStorageService } from './picgo-storage.service';

// Mock external dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

vi.mock('crypto', () => ({
  createHash: vi.fn(),
}));

vi.mock('picgo', () => {
  const mockPicGoInstance = {
    setConfig: vi.fn(),
    upload: vi.fn(),
    pluginHandler: {
      install: vi.fn(),
    },
  };

  return {
    default: vi.fn(function PicGo() {
      return mockPicGoInstance;
    }),
    PicGo: vi.fn(function PicGo() {
      return mockPicGoInstance;
    }),
  };
});

describe('PicgoStorageService', () => {
  let service: PicgoStorageService;
  let mockPicGo: any;
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
    vi.spyOn(Date, 'now').mockReturnValue(1640995200000);

    const module: TestingModule = await Test.createTestingModule({
      providers: [PicgoStorageService],
    }).compile();

    service = module.get<PicgoStorageService>(PicgoStorageService);
    mockPicGo = (service as any).picgo;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('configure', () => {
    it('should configure PicGo with provided config', () => {
      const config = { uploader: 'test', apiKey: 'secret' };

      service.configure(config);

      expect(mockPicGo.setConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('installPlugins', () => {
    it('should install plugins successfully', async () => {
      const plugins = ['picgo-plugin-test'];
      mockPicGo.pluginHandler.install.mockResolvedValue({
        success: true,
        body: 'Installation successful',
      });

      await service.installPlugins(plugins);

      expect(mockPicGo.pluginHandler.install).toHaveBeenCalledWith(plugins);
    });

    it('should handle plugin installation failure', async () => {
      const plugins = ['picgo-plugin-test'];
      mockPicGo.pluginHandler.install.mockResolvedValue({
        success: false,
        body: 'Installation failed',
      });

      await service.installPlugins(plugins);

      expect(mockPicGo.pluginHandler.install).toHaveBeenCalledWith(plugins);
    });

    it('should handle plugin installation error', async () => {
      const plugins = ['picgo-plugin-test'];
      const error = new Error('Network error');
      mockPicGo.pluginHandler.install.mockRejectedValue(error);

      await service.installPlugins(plugins);

      expect(mockPicGo.pluginHandler.install).toHaveBeenCalledWith(plugins);
    });

    it('should do nothing when no plugins provided', async () => {
      await service.installPlugins([]);

      expect(mockPicGo.pluginHandler.install).not.toHaveBeenCalled();
    });
  });

  describe('upload', () => {
    beforeEach(() => {
      // Mock crypto hash
      const mockHash = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('abcd1234abcd1234'),
      };
      vi.mocked(createHash).mockReturnValue(mockHash as any);

      // Mock fs operations
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fsPromises.unlink).mockResolvedValue(undefined);
    });

    it('should upload file successfully', async () => {
      const filename = 'test.jpg';
      const expectedTmpFilename = '1640995200000-abcd1234.jpg';
      const expectedUrl = 'https://example.com/uploaded-image.jpg';

      mockPicGo.upload.mockResolvedValue([
        {
          imgUrl: expectedUrl,
        },
      ]);

      const result = await service.upload(mockFile, filename);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(join(process.cwd(), 'tmp'), {
        recursive: true,
      });
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        join(process.cwd(), 'tmp', expectedTmpFilename),
        mockFile.buffer,
      );
      expect(mockPicGo.upload).toHaveBeenCalledWith([
        join(process.cwd(), 'tmp', expectedTmpFilename),
      ]);
      expect(fsPromises.unlink).toHaveBeenCalledWith(
        join(process.cwd(), 'tmp', expectedTmpFilename),
      );
      expect(result).toEqual({
        url: expectedUrl,
        filename,
        size: mockFile.buffer.length,
        mimeType: mockFile.mimetype,
      });
    });

    it('should handle upload failure', async () => {
      const filename = 'test.jpg';
      const uploadError = new Error('Upload failed');

      mockPicGo.upload.mockRejectedValue(uploadError);

      await expect(service.upload(mockFile, filename)).rejects.toThrow('PicGo upload failed');
    });

    it('should handle empty upload result', async () => {
      const filename = 'test.jpg';

      mockPicGo.upload.mockResolvedValue([]);

      await expect(service.upload(mockFile, filename)).rejects.toThrow('PicGo upload failed');
    });

    it('should handle filename without extension', async () => {
      const filename = 'test';
      const expectedTmpFilename = '1640995200000-abcd1234.test';
      const expectedUrl = 'https://example.com/uploaded-image';

      mockPicGo.upload.mockResolvedValue([
        {
          imgUrl: expectedUrl,
        },
      ]);

      const result = await service.upload(mockFile, filename);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        join(process.cwd(), 'tmp', expectedTmpFilename),
        mockFile.buffer,
      );
      expect(result.url).toBe(expectedUrl);
    });
  });

  describe('delete', () => {
    it('should return false (not implemented)', async () => {
      const result = await service.delete('test.jpg');

      expect(result).toBe(false);
    });
  });

  describe('getUrl', () => {
    it('should return filename as placeholder', () => {
      const result = service.getUrl('abc');

      expect(result).toBe('abc');
    });
  });
});
