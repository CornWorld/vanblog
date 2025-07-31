import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaService } from './services/media.service';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { promises as fsPromises } from 'fs';

vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
  })),
}));

describe('MediaService', () => {
  let service: MediaService;
  let mockDb: {
    insert: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    offset: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: 1,
          filename: 'test.jpg',
          path: '/uploads/images/test.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          width: 1920,
          height: 1080,
          hash: 'testhash',
          provider: 'local',
          createdAt: new Date(),
        },
      ]),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };

    service = new MediaService(mockDb as unknown as LibSQLDatabase);
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const result = await service.uploadFile(mockFile);

      expect(result).toBeDefined();
      expect(result.filename).toContain('.jpg');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(fsPromises.mkdir).toHaveBeenCalled();
      expect(fsPromises.writeFile).toHaveBeenCalled();
    });

    it('should use custom filename if provided', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      await service.uploadFile(mockFile, 'custom.jpg');

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('listFiles', () => {
    it('should list files with pagination', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      });

      const result = await service.listFiles({
        page: 1,
        pageSize: 20,
      });

      expect(result).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should filter files by keyword', async () => {
      await service.listFiles({
        keyword: 'test',
        page: 1,
        pageSize: 20,
      });

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            path: '/uploads/images/test.jpg',
            provider: 'local',
          },
        ]),
      });

      const result = await service.deleteFile(1);

      expect(result.success).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(fsPromises.unlink).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent file', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      await expect(service.deleteFile(999)).rejects.toThrow('File with ID 999 not found');
    });
  });

  describe('deleteFiles', () => {
    it('should delete multiple files successfully', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 1, path: '/uploads/images/test1.jpg', provider: 'local' },
          { id: 2, path: '/uploads/images/test2.jpg', provider: 'local' },
        ]),
      });

      const result = await service.deleteFiles([1, 2]);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(mockDb.delete).toHaveBeenCalled();
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
          filename: 'test1.jpg',
          path: '/uploads/images/test1.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          createdAt: new Date(),
        },
        {
          id: 2,
          filename: 'test2.jpg',
          path: '/uploads/images/test2.jpg',
          size: 2048,
          mimeType: 'image/png',
          createdAt: new Date(),
        },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue(mockFiles),
      });

      const result = await service.exportAllImages();

      expect(result.total).toBe(2);
      expect(result.files).toHaveLength(2);
    });
  });
});
