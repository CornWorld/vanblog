/**
 * TagService - Complex Article Queries Tests
 *
 * Tests complex article queries by tag name or ID with pagination.
 * Covers getArticlesByTagName and getArticlesByTagId methods.
 *
 * Related tests:
 * - tag.service.spec.ts - Core CRUD operations
 * - tag.service.associations.spec.ts - Association queries
 * - tag.service.boundaries.spec.ts - Boundary conditions
 */
import { NotFoundException } from '@nestjs/common';
import { describe, beforeEach, it, expect, afterEach, vi } from 'vitest';

import { TagService } from './tag.service';

describe('TagService - Complex Queries', () => {
  let service: TagService;
  let module: any;
  let mockDb: any;

  beforeEach(async () => {
    const databaseMockBuilder = Mock.db();
    mockDb = databaseMockBuilder.build();

    module = await MockUtils.createTagServiceTestingModule({
      service: TagService,
      dbMock: mockDb,
    }).compile();

    service = module.get<TagService>(TagService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getArticlesByTagName', () => {
    it('should return articles for a tag by name', async () => {
      const mockTag = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = [
        {
          id: 1,
          title: 'Article 1',
          content: 'Content 1',
          pathname: '/article-1',
          tags: ['Technology', 'Programming'],
          category: 'Tech',
          author: 'admin',
          top: 0,
          hidden: false,
          private: false,
          password: null,
          viewer: 100,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      // Mock findByName
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ ...mockTag, createdAt: new Date(), updatedAt: new Date() }]),
          }),
        }),
      });

      // Mock findOne
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ ...mockTag, createdAt: new Date(), updatedAt: new Date() }]),
          }),
        }),
      });

      // Mock articles query (first in Promise.all)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockArticles),
              }),
            }),
          }),
        }),
      });

      // Mock count query (second in Promise.all)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const result = await service.getArticlesByTagName('Technology', {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should throw NotFoundException when tag name not found', async () => {
      // Mock the complete chain for findByName
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.getArticlesByTagName('NonExistent', {
          page: 1,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getArticlesByTagId', () => {
    it('should return articles for a tag', async () => {
      const mockTag = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = [
        {
          id: 1,
          title: 'Article 1',
          content: 'Content 1',
          pathname: '/article-1',
          tags: ['Technology'],
          category: 'Tech',
          author: 'admin',
          top: 0,
          hidden: false,
          private: false,
          password: null,
          viewer: 100,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      // Mock findOne - first select query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ ...mockTag, createdAt: new Date(), updatedAt: new Date() }]),
          }),
        }),
      });

      // Mock articles query (first in Promise.all)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockArticles),
              }),
            }),
          }),
        }),
      });

      // Mock count query (second in Promise.all)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const result = await service.getArticlesByTagId(1, {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.items[0].title).toBe('Article 1');
    });

    it('should handle pagination correctly', async () => {
      const mockTag = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Mock findOne - first select query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ ...mockTag, createdAt: new Date(), updatedAt: new Date() }]),
          }),
        }),
      });

      // Mock articles query (first in Promise.all) - empty for page 2
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      // Mock count query (second in Promise.all)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 25 }]),
        }),
      });

      const result = await service.getArticlesByTagId(1, {
        page: 2,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
    });

    it('should handle includeHidden parameter', async () => {
      const mockTag = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = [
        {
          id: 1,
          title: 'Hidden Article',
          content: 'Content 1',
          pathname: '/hidden-article',
          tags: ['Technology'],
          category: 'Tech',
          author: 'admin',
          top: 0,
          hidden: true,
          private: false,
          password: null,
          viewer: 10,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      // Mock findOne
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ ...mockTag, createdAt: new Date(), updatedAt: new Date() }]),
          }),
        }),
      });

      // Mock articles query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockArticles),
              }),
            }),
          }),
        }),
      });

      // Mock count query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const result = await service.getArticlesByTagId(1, {
        page: 1,
        pageSize: 10,
        includeHidden: true,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.items).toHaveLength(1);
    });

    it('should throw NotFoundException when tag not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.getArticlesByTagId(999, {
          page: 1,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle zero total pages correctly', async () => {
      const mockTag = {
        id: 1,
        name: 'EmptyTag',
        slug: 'empty',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Mock findOne
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ ...mockTag, createdAt: new Date(), updatedAt: new Date() }]),
          }),
        }),
      });

      // Mock articles query - empty
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      // Mock count query - 0 articles
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const result = await service.getArticlesByTagId(1, {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
