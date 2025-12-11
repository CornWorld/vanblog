import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { CategoryService } from './category.service';

describe('CategoryService', () => {
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

  describe('findAll', () => {
    it('should return categories with article count', async () => {
      const mockCategories = [
        {
          id: 1,
          name: 'Technology',
          slug: undefined,
          description: 'Tech articles',
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          articleCount: 5,
        },
      ];

      mockDb.groupBy.mockResolvedValueOnce(mockCategories);

      const result = (await service.findAll()) as any;

      expect(result.items).toHaveLength(1);
      expect((result.items as any[])[0].name).toBe('Technology');
      expect((result.items as any[])[0].articleCount).toBe(5);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a single category', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: undefined,
        description: 'Tech articles',
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockCategory]);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Technology');
    });

    it('should throw NotFoundException when category not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const mockCreatedCategory = {
        id: 1,
        name: 'New Category',
        slug: undefined,
        description: 'New category description',
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedCategory]);

      const createDto = {
        name: 'New Category',
        slug: 'new-category',
        description: 'New category description',
      };

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.name).toBe('New Category');
    });
  });

  describe('update', () => {
    it('should update an existing category', async () => {
      const mockUpdatedCategory = {
        id: 1,
        name: 'Updated Category',
        slug: undefined,
        description: 'Updated description',
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock update returning
      mockDb.returning.mockResolvedValueOnce([mockUpdatedCategory]);

      const updateDto = {
        name: 'Updated Category',
        description: 'Updated description',
      };

      const result = await service.update(1, updateDto);

      expect(result.name).toBe('Updated Category');
      expect(result.description).toBe('Updated description');
    });

    it('should throw NotFoundException when category not found', async () => {
      // Mock update returning empty array
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a category', async () => {
      const mockCategory = {
        id: 1,
        name: 'Category1',
        slug: null,
        description: null,
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findOne call
      mockDb.limit.mockResolvedValueOnce([mockCategory]);
      // Mock article count check - need to set up the mock chain properly
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.then = vi.fn().mockResolvedValueOnce([{ count: 0 }]);
      // Mock delete returning
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when category not found', async () => {
      // Mock findOne to throw NotFoundException
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
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
  });
});
