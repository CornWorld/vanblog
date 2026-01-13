import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { Mock } from '@test/mock';
import { LoggerService } from '../../core/logger/logger.service';
import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';
import { StorageProvider } from './dto/storage-config.dto';

import { MediaService } from './services/media.service';
import { StorageFactoryService } from './services/storage-factory.service';

describe('MediaService - Batch Operation Limits', () => {
  let service: MediaService;
  let mockStorageService: any;
  let mockStorageFactory: any;
  let mockHookService: any;
  let mockLogger: any;
  let mockDb: any;

  beforeEach(async () => {
    mockStorageService = Mock.storage();
    mockStorageFactory = Mock.storageFactory(mockStorageService, StorageProvider.LOCAL);
    mockHookService = Mock.hook();
    mockLogger = Mock.logger();

    // Mock database
    mockDb = {
      select: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: StorageFactoryService, useValue: mockStorageFactory },
        { provide: HookService, useValue: mockHookService as any },
        { provide: LoggerService, useValue: mockLogger },
        { provide: DATABASE_CONNECTION, useValue: mockDb },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  describe('deleteFiles batch limits', () => {
    it('should reject empty array', async () => {
      await expect(service.deleteFiles([])).rejects.toThrow('No file IDs provided');
    });

    it('should allow deletion of 100 files', async () => {
      const ids = Array.from({ length: 100 }, (_, i) => i + 1);
      const mockFiles = ids.map((id) =>
        Mock.mediaFile({
          id,
          filename: `file${String(id)}.jpg`,
          provider: 'local',
        }),
      );

      // Mock database query
      const mockWhere = vi.fn().mockResolvedValue(mockFiles);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      // Mock database delete
      const mockDeleteWhere = vi.fn().mockResolvedValue({ changes: 100 });
      mockDb.delete.mockReturnValue({ where: mockDeleteWhere });

      const result = await service.deleteFiles(ids);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(100);
      expect(result.message).toBe('100 files deleted successfully');
    });

    it('should reject deletion of more than 100 files', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) => i + 1);

      await expect(service.deleteFiles(tooManyIds)).rejects.toThrow(
        'Cannot delete more than 100 files at once',
      );

      // Verify no database operations were attempted
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('should handle edge case of exactly 100 files', async () => {
      const exactlyHundredIds = Array.from({ length: 100 }, (_, i) => i + 1);
      const mockFiles = exactlyHundredIds.map((id) =>
        Mock.mediaFile({
          id,
          filename: `file${String(id)}.jpg`,
          provider: 'local',
        }),
      );

      // Mock database operations
      const mockWhere = vi.fn().mockResolvedValue(mockFiles);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const mockDeleteWhere = vi.fn().mockResolvedValue({ changes: 100 });
      mockDb.delete.mockReturnValue({ where: mockDeleteWhere });

      const result = await service.deleteFiles(exactlyHundredIds);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(100);
    });

    it('should handle single file deletion within limits', async () => {
      const singleId = [1];
      const mockFile = Mock.mediaFile({
        id: 1,
        filename: 'single.jpg',
        provider: 'local',
      });

      // Mock database operations
      const mockWhere = vi.fn().mockResolvedValue([mockFile]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const mockDeleteWhere = vi.fn().mockResolvedValue({ changes: 1 });
      mockDb.delete.mockReturnValue({ where: mockDeleteWhere });

      const result = await service.deleteFiles(singleId);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
      expect(result.message).toBe('1 files deleted successfully');
    });

    it('should handle storage deletion failures gracefully within limits', async () => {
      const ids = [1, 2, 3];
      const mockFiles = ids.map((id) =>
        Mock.mediaFile({
          id,
          filename: `file${String(id)}.jpg`,
          provider: 'local',
        }),
      );

      // Mock storage service to fail for some files
      mockStorageService.delete
        .mockResolvedValueOnce(true) // First file succeeds
        .mockRejectedValueOnce(new Error('Storage error')) // Second file fails
        .mockResolvedValueOnce(true); // Third file succeeds

      // Mock database operations
      const mockWhere = vi.fn().mockResolvedValue(mockFiles);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const mockDeleteWhere = vi.fn().mockResolvedValue({ changes: 3 });
      mockDb.delete.mockReturnValue({ where: mockDeleteWhere });

      const result = await service.deleteFiles(ids);

      // Should still succeed despite storage failures
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(3);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete file from storage: file2.jpg',
        expect.any(String),
        'MediaService',
      );
    });
  });

  describe('performance considerations', () => {
    it('should handle maximum allowed batch size efficiently', async () => {
      const maxIds = Array.from({ length: 100 }, (_, i) => i + 1);
      const mockFiles = maxIds.map((id) =>
        Mock.mediaFile({
          id,
          filename: `perf${String(id)}.jpg`,
          provider: 'local',
        }),
      );

      // Mock database operations
      const mockWhere = vi.fn().mockResolvedValue(mockFiles);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const mockDeleteWhere = vi.fn().mockResolvedValue({ changes: 100 });
      mockDb.delete.mockReturnValue({ where: mockDeleteWhere });

      const startTime = Date.now();
      const result = await service.deleteFiles(maxIds);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(100);

      // Verify hooks were called for batch operations
      expect(mockHookService.doAction).toHaveBeenCalledWith('media|beforeDeleteBatch', {
        files: mockFiles,
        ids: maxIds,
      });
      expect(mockHookService.doAction).toHaveBeenCalledWith('media|afterDeleteBatch', {
        deletedCount: 100,
        files: expect.any(Array),
      });

      // Basic performance check - should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });
  });
});
