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
import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { TagService } from './tag.service';

describe('TagService - Complex Queries', () => {
  let service: TagService;
  let module: TestingModule;
  let mockHookService: Partial<HookService>;

  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    offset: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    };

    mockHookService = {
      applyFilters: vi.fn().mockImplementation(async (_hookName, data) => Promise.resolve(data)),
      doAction: vi.fn().mockResolvedValue(undefined),
    };

    module = await Test.createTestingModule({
      imports: [],
      providers: [
        TagService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: StatisticsService,
          useValue: {
            getOverallStatistics: vi.fn().mockResolvedValue({
              totalCategories: 0,
              totalTags: 0,
              totalArticles: 0,
              publishedArticles: 0,
              privateArticles: 0,
              hiddenArticles: 0,
              totalViews: 0,
              categories: [],
              tags: [],
            }),
          },
        },
        {
          provide: QueryOptimizerService,
          useValue: {
            withPerformanceMonitoring: vi.fn().mockImplementation((_name, fn) => fn()),
            batchCountArticlesByTags: vi.fn().mockResolvedValue(new Map()),
            batchCountArticlesByCategories: vi.fn().mockResolvedValue(new Map()),
            buildOptimizedSearchQuery: vi.fn().mockReturnValue([]),
            logSlowQuery: vi.fn(),
          },
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
      ],
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
