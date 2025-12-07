import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';

import { DraftVersionService } from './draft-version.service';

describe('DraftVersionService', () => {
  let service: DraftVersionService;
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    // Create chainable mock object
    const createChainableMock = (): Record<string, ReturnType<typeof vi.fn>> => {
      const mock: Record<string, ReturnType<typeof vi.fn>> = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      };

      return mock;
    };

    mockDb = createChainableMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftVersionService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<DraftVersionService>(DraftVersionService);
  });

  describe('createVersion', () => {
    it('should create a new version from existing draft', async () => {
      const mockDraft = {
        id: 1,
        title: 'Test Draft',
        content: 'Test content',
        tags: JSON.stringify(['test']),
        author: 'admin',
        pathname: null,
        category: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVersion = {
        id: 1,
        draftId: 1,
        version: 2,
        title: 'Test Draft',
        content: 'Test content',
        tags: JSON.stringify(['test']),
        author: 'admin',
        pathname: null,
        category: null,
        createdAt: new Date(),
      };

      // Setup for first query: select().from(drafts).where().limit()
      let limitCallCount = 0;
      mockDb.limit.mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) {
          return {
            ...mockDb,
            then: (resolve: any) => resolve([mockDraft]),
          };
        }
        return mockDb;
      });

      // Setup for second query: select({maxVersion}).from(draftVersions).where()
      let whereCallCount = 0;
      mockDb.where.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 2) {
          return {
            ...mockDb,
            then: (resolve: any) => resolve([{ maxVersion: 1 }]),
          };
        }
        return mockDb;
      });

      // Setup for insert query
      mockDb.returning.mockResolvedValueOnce([mockVersion]);

      const result = await service.createVersion(1);

      expect(result.version).toBe(2);
      expect(result.title).toBe('Test Draft');
    });

    it('should throw NotFoundException when draft not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.createVersion(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVersions', () => {
    it('should return all versions for a draft', async () => {
      const mockVersions = [
        {
          id: 2,
          draftId: 1,
          version: 2,
          title: 'Version 2',
          content: 'Content 2',
          tags: JSON.stringify(['v2']),
          author: 'admin',
          pathname: null,
          category: null,
          createdAt: dayjs().format(),
        },
        {
          id: 1,
          draftId: 1,
          version: 1,
          title: 'Version 1',
          content: 'Content 1',
          tags: JSON.stringify(['legacy']),
          author: 'admin',
          pathname: null,
          category: null,
          createdAt: dayjs().format(),
        },
      ];

      mockDb.orderBy.mockResolvedValueOnce(mockVersions);

      const result = await service.getVersions(1);

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(2);
      expect(result[1].version).toBe(1);
    });
  });

  describe('getVersion', () => {
    it('should return a specific version', async () => {
      const mockVersion = {
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Test Version',
        content: 'Test content',
        tags: JSON.stringify(['test']),
        author: 'admin',
        pathname: null,
        category: null,
        createdAt: dayjs().format(),
      };

      mockDb.limit.mockResolvedValueOnce([mockVersion]);

      const result = await service.getVersion(1, 1);

      expect(result.version).toBe(1);
      expect(result.title).toBe('Test Version');
    });

    it('should throw NotFoundException when version not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.getVersion(1, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreVersion', () => {
    it('should restore a draft to a specific version', async () => {
      const mockVersion = {
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Old Version',
        content: 'Old content',
        tags: JSON.stringify(['old']),
        author: 'admin',
        pathname: null,
        category: null,
        createdAt: dayjs().format(),
      };

      // Mock for getVersion call
      let limitCallCount = 0;
      mockDb.limit.mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) {
          return {
            ...mockDb,
            then: (resolve: any) => resolve([mockVersion]),
          };
        }
        return mockDb;
      });

      // Mock for update query - where should return mockDb for chaining
      let whereCallCount = 0;
      mockDb.where.mockImplementation(() => {
        whereCallCount++;
        // For the update query (3rd where call)
        if (whereCallCount === 3) {
          return {
            ...mockDb,
            then: (resolve: any) => resolve([{ id: 1 }]),
          };
        }
        return mockDb;
      });

      await service.restoreVersion(1, 1);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Old Version',
          content: 'Old content',
        }),
      );
    });
  });

  describe('deleteVersion', () => {
    it('should delete a specific version', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await service.deleteVersion(1, 1);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when version not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.deleteVersion(1, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAllVersions', () => {
    it('should delete all versions for a draft', async () => {
      mockDb.where.mockResolvedValueOnce([]);

      await service.deleteAllVersions(1);

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
