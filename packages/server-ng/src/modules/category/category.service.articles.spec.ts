/**
 * CategoryService - Articles Query Tests
 *
 * 测试分类文章查询相关功能：
 * - 按分类 ID 查询文章列表
 * - 分页处理（page, pageSize, totalPages）
 * - 排序（sortBy, sortOrder）
 * - includeHidden 参数处理
 * - Promise.all 并发查询场景
 * - 空结果处理
 * - 错误处理
 *
 * @module CategoryService
 * @group articles
 */

import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { CategoryService } from './category.service';

describe('CategoryService - Articles Query', () => {
  let service: CategoryService;
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
    leftJoin: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    then?: ReturnType<typeof vi.fn>;
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
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    };

    mockHookService = Mock.hook();

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        CategoryService,
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
        {
          provide: ConfigService,
          useValue: Mock.config(),
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('getArticlesByCategoryId', () => {
    it('should return articles for a category', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = [
        {
          id: 1,
          title: 'Article 1',
          content: 'Content 1',
          pathname: '/article-1',
          tags: ['tag1', 'tag2'],
          category: 'Technology',
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
              .mockResolvedValue([
                { ...mockCategory, createdAt: new Date(), updatedAt: new Date() },
              ]),
          }),
        }),
      });

      // Mock articles query (first in Promise.all) - needs full chain
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

      const result = await service.getArticlesByCategoryId(1, {
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
    });

    it('should handle pagination correctly', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Mock findOne - first select query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { ...mockCategory, createdAt: new Date(), updatedAt: new Date() },
              ]),
          }),
        }),
      });

      // Mock articles query (first in Promise.all) - needs full chain
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

      const result = await service.getArticlesByCategoryId(1, {
        page: 2,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
    });

    it('should throw NotFoundException when category not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.getArticlesByCategoryId(999, {
          page: 1,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle includeHidden parameter', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Mock findOne - first select query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { ...mockCategory, createdAt: new Date(), updatedAt: new Date() },
              ]),
          }),
        }),
      });

      // Mock articles query (first in Promise.all) - needs full chain
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
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const result = await service.getArticlesByCategoryId(1, {
        page: 1,
        pageSize: 10,
        includeHidden: true,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      // Verify the method runs successfully with includeHidden parameter
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
    });
  });

  describe('Promise.all concurrent query scenarios', () => {
    it('should resolve Promise.all queries in correct order with articles and count', async () => {
      const mockCategory = {
        id: 1,
        name: 'Tech',
        slug: 'tech',
        description: null,
        private: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockArticles = [
        { id: 1, title: 'Article 1', content: 'Content', createdAt: new Date() },
        { id: 2, title: 'Article 2', content: 'Content', createdAt: new Date() },
      ];

      const mockCount = [{ count: 2 }];

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // findOne query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockCategory]),
              }),
            }),
          };
        } else if (selectCallCount === 2) {
          // articles query (first in Promise.all)
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockArticles),
                  }),
                }),
              }),
            }),
          };
        } else if (selectCallCount === 3) {
          // count query (second in Promise.all)
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockCount),
            }),
          };
        }
        return mockDb;
      });

      const result = await service.getArticlesByCategoryId(1, {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      // Verify both queries resolved
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].id).toBe(1);
      expect(result.items[1].id).toBe(2);
    });

    it('should handle Promise.all with empty articles but valid count', async () => {
      const mockCategory = {
        id: 1,
        name: 'Empty',
        slug: 'empty',
        description: null,
        private: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockArticles: any[] = [];
      const mockCount = [{ count: 0 }];

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockCategory]),
              }),
            }),
          };
        } else if (selectCallCount === 2) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockArticles),
                  }),
                }),
              }),
            }),
          };
        } else if (selectCallCount === 3) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockCount),
            }),
          };
        }
        return mockDb;
      });

      const result = await service.getArticlesByCategoryId(1, {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should handle concurrent queries when articles rejects with error', async () => {
      const mockCategory = {
        id: 1,
        name: 'Tech',
        slug: 'tech',
        description: null,
        private: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockCategory]),
              }),
            }),
          };
        } else if (selectCallCount === 2) {
          // Articles query fails
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockRejectedValue(new Error('Articles query failed')),
                  }),
                }),
              }),
            }),
          };
        }
        return mockDb;
      });

      await expect(
        service.getArticlesByCategoryId(1, {
          page: 1,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ).rejects.toThrow('Articles query failed');
    });
  });
});
