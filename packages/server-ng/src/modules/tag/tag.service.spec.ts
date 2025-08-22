import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { TagService } from './tag.service';

describe('TagService', () => {
  let service: TagService;
  let module: TestingModule;
  let mockHookService: Partial<HookService>;
  let mockQueryOptimizer: any;

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
    mockQueryOptimizer = module.get(QueryOptimizerService);
  });

  describe('findAll', () => {
    it('should return all tags', async () => {
      const mockTags = [
        {
          id: 1,
          name: 'Tag1',
          slug: 'tag1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock the first query for getting all tags
      mockDb.from.mockResolvedValueOnce(mockTags);

      // Mock the QueryOptimizerService to return article counts
      const articleCounts = { Tag1: 3 }; // tag name 'Tag1' has 3 articles
      mockQueryOptimizer.batchCountArticlesByTags.mockResolvedValueOnce(articleCounts);

      const result = await service.findAll();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Tag1');
      expect(result.items[0].articleCount).toBe(3);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a single tag', async () => {
      const mockTag = {
        id: 1,
        name: 'Tag1',
        slug: 'tag1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockTag]);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Tag1');
    });

    it('should throw NotFoundException when tag not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new tag', async () => {
      const mockCreatedTag = {
        id: 1,
        name: 'New Tag',
        slug: 'new-tag',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedTag]);

      const createDto = {
        name: 'New Tag',
        slug: 'new-tag',
      };

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.name).toBe('New Tag');
    });
  });

  describe('update', () => {
    it('should update an existing tag', async () => {
      const mockUpdatedTag = {
        id: 1,
        name: 'Updated Tag',
        slug: 'updated-tag',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockUpdatedTag]);

      const updateDto = {
        name: 'Updated Tag',
      };

      const result = await service.update(1, updateDto);

      expect(result.name).toBe('Updated Tag');
    });

    it('should throw NotFoundException when tag not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a tag', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when tag not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTagsWithCategories', () => {
    it('should return tags with their categories', async () => {
      const mockTags = [
        { id: 1, name: 'Tag1', slug: 'tag1' },
        { id: 2, name: 'Tag2', slug: 'tag2' },
      ];

      const mockCategories = [
        { category: 'Category1', count: 2 },
        { category: 'Category2', count: 1 },
      ];

      // Mock for getting all tags
      mockDb.from.mockResolvedValueOnce(mockTags);

      // Mock for getting categories for each tag
      mockDb.groupBy.mockResolvedValue(mockCategories);

      const result = await service.getTagsWithCategories();

      expect(result).toHaveLength(2);
      expect(result[0].categories).toHaveLength(2);
      expect(result[0].categories[0].name).toBe('Category1');
      expect(result[0].categories[0].count).toBe(2);
    });
  });
});
