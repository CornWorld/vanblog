/**
 * CategoryService - Associations Tests
 *
 * 测试分类关联数据查询功能：
 * - 获取分类及其标签（getCategoriesWithTags）
 * - 标签去重与合并
 * - 处理无文章的分类
 * - 处理 null 标签
 *
 * @module CategoryService
 * @group associations
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { CategoryService } from './category.service';

describe('CategoryService - Associations', () => {
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

    mockHookService = {
      applyFilters: vi.fn().mockImplementation(async (_hookName, data) => Promise.resolve(data)),
      doAction: vi.fn().mockResolvedValue(undefined),
    };

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
          useValue: {
            jwt: { secret: 'test-secret-key' },
            get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('getCategoriesWithTags', () => {
    it('should return categories with their tags', async () => {
      const mockCategories = [
        {
          id: 1,
          name: 'Category1',
          slug: undefined,
          description: null,
          private: false,
          password: null,
        },
        {
          id: 2,
          name: 'Category2',
          slug: undefined,
          description: null,
          private: false,
          password: null,
        },
      ];

      const mockArticles = [
        { category: 'Category1', tags: ['tag1', 'tag2'] },
        { category: 'Category1', tags: ['tag2', 'tag3'] },
        { category: 'Category2', tags: ['tag4'] },
      ];

      // Mock the first query: getting all categories
      mockDb.from.mockResolvedValueOnce(mockCategories);

      // Mock the second query: getting articles with tags
      mockDb.where.mockResolvedValueOnce(mockArticles);

      const result = await service.getCategoriesWithTags();

      expect(result).toHaveLength(2);
      expect(result[0].category.name).toBe('Category1');
      expect(result[0].tags).toHaveLength(3); // tag1, tag2, tag3
      expect(result[1].category.name).toBe('Category2');
      expect(result[1].tags).toHaveLength(1); // tag4
    });

    it('should handle categories with no articles', async () => {
      const mockCategories = [
        {
          id: 1,
          name: 'EmptyCategory',
          slug: null,
          description: null,
          private: false,
          password: null,
        },
      ];

      const mockArticles: any[] = [];

      mockDb.from.mockResolvedValueOnce(mockCategories);
      mockDb.where.mockResolvedValueOnce(mockArticles);

      const result = await service.getCategoriesWithTags();

      expect(result).toHaveLength(1);
      expect(result[0].category.name).toBe('EmptyCategory');
      expect(result[0].tags).toHaveLength(0);
    });

    it('should handle articles with null tags', async () => {
      const mockCategories = [
        {
          id: 1,
          name: 'Category1',
          slug: null,
          description: null,
          private: false,
          password: null,
        },
      ];

      const mockArticles = [
        { category: 'Category1', tags: null },
        { category: 'Category1', tags: ['tag1'] },
      ];

      mockDb.from.mockResolvedValueOnce(mockCategories);
      mockDb.where.mockResolvedValueOnce(mockArticles);

      const result = await service.getCategoriesWithTags();

      expect(result[0].tags).toHaveLength(1);
      expect(result[0].tags[0].name).toBe('tag1');
    });
  });
});
