/**
 * TagService - Core CRUD Operations Tests
 *
 * Tests core CRUD functionality, basic queries, and hook triggering.
 *
 * Related tests:
 * - tag.service.associations.spec.ts - Association queries (findOrCreateTags, getTagsWithCategories)
 * - tag.service.queries.spec.ts - Complex article queries (getArticlesByTagName, getArticlesByTagId)
 * - tag.service.boundaries.spec.ts - Boundary conditions and edge cases
 */
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';
import { MockUtils } from '../../../test/mock-utils';

import { TagService } from './tag.service';

describe('TagService', () => {
  let service: TagService;
  let module: TestingModule;
  let mockHookService: Partial<HookService>;
  let mockDb: any;
  let mockQueryOptimizer: any;
  let mockStatisticsService: any;

  beforeEach(async () => {
    const databaseMock = new MockUtils.database();
    mockDb = databaseMock.build();

    mockHookService = MockUtils.services.createHookServiceMock();

    mockStatisticsService = {
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
          useValue: mockStatisticsService,
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tags with article counts', async () => {
      const mockTags = [
        {
          id: 1,
          name: 'Tag1',
          slug: 'tag1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 2,
          name: 'Tag2',
          slug: 'tag2',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      mockDb.from.mockResolvedValueOnce(mockTags);

      const articleCounts = { Tag1: 3, Tag2: 5 };
      mockQueryOptimizer.batchCountArticlesByTags.mockResolvedValueOnce(articleCounts);

      const result = (await service.findAll()) as any;

      expect(result.items).toHaveLength(2);
      expect((result.items as any[])[0].name).toBe('Tag1');
      expect((result.items as any[])[0].articleCount).toBe(3);
      expect((result.items as any[])[1].name).toBe('Tag2');
      expect((result.items as any[])[1].articleCount).toBe(5);
      expect(result.total).toBe(2);
    });

    it('should return empty list when no tags exist', async () => {
      mockDb.from.mockResolvedValueOnce([]);

      const result = (await service.findAll()) as any;

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(mockQueryOptimizer.batchCountArticlesByTags).not.toHaveBeenCalled();
    });

    it('should handle tags with no articles', async () => {
      const mockTags = [
        {
          id: 1,
          name: 'UnusedTag',
          slug: 'unused-tag',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.from.mockResolvedValueOnce(mockTags);
      mockQueryOptimizer.batchCountArticlesByTags.mockResolvedValueOnce({});

      const result = (await service.findAll()) as any;

      expect(result.items).toHaveLength(1);
      expect((result.items as any[])[0].articleCount).toBe(0);
    });

    it('should use performance monitoring', async () => {
      mockDb.from.mockResolvedValueOnce([]);

      await service.findAll();

      expect(mockQueryOptimizer.withPerformanceMonitoring).toHaveBeenCalledWith(
        'TagService.findAll',
        expect.any(Function),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single tag', async () => {
      const mockTag = {
        id: 1,
        name: 'Tag1',
        slug: 'tag1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      mockDb.limit.mockResolvedValueOnce([mockTag]);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Tag1');
      expect(result.slug).toBe('tag1');
      expect(result.createdAt).toBeDefined();
    });

    it('should handle tag with null slug', async () => {
      const mockTag = {
        id: 1,
        name: 'Tag1',
        slug: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockTag]);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.slug).toBeUndefined();
    });

    it('should throw NotFoundException when tag not found', async () => {
      // Mock the complete chain for findOne
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new tag', async () => {
      const mockCreatedTag = {
        id: 1,
        name: 'New Tag',
        slug: 'new-tag',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedTag]);

      const createDto = {
        name: 'New Tag',
        slug: 'new-tag',
      };

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.name).toBe('New Tag');
      expect(result.slug).toBe('new-tag');
    });

    it('should apply beforeCreate filter hook', async () => {
      const createDto = {
        name: 'Test Tag',
        slug: 'test-tag',
      };

      const modifiedDto = {
        ...createDto,
        name: 'Modified by hook',
      };

      mockHookService.applyFilters = vi
        .fn()
        .mockImplementation(async (_hookName, _data) => Promise.resolve(modifiedDto));

      const mockCreatedTag = {
        id: 1,
        ...modifiedDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedTag]);

      await service.create(createDto);

      expect(mockHookService.applyFilters).toHaveBeenCalledWith(
        'tag|beforeCreate',
        createDto,
        expect.objectContaining({ action: 'create' }),
      );
    });

    it('should trigger afterCreate action hook', async () => {
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

      await service.create(createDto);

      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'tag|afterCreate',
        expect.objectContaining({
          id: 1,
          name: 'New Tag',
        }),
        expect.objectContaining({
          id: 1,
          name: 'New Tag',
          slug: 'new-tag',
        }),
      );
    });

    it('should handle beforeCreate hook errors gracefully', async () => {
      const createDto = {
        name: 'Test Tag',
        slug: 'test-tag',
      };

      mockHookService.applyFilters = vi.fn().mockRejectedValueOnce(new Error('Hook error'));

      const mockCreatedTag = {
        id: 1,
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedTag]);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should throw error when insert fails', async () => {
      const createDto = {
        name: 'Test Tag',
        slug: 'test-tag',
      };

      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow('Failed to create tag');
    });
  });

  describe('update', () => {
    it('should update an existing tag', async () => {
      const mockUpdatedTag = {
        id: 1,
        name: 'Updated Tag',
        slug: 'updated-tag',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockDb.returning.mockResolvedValueOnce([mockUpdatedTag]);

      const updateDto = {
        name: 'Updated Tag',
        slug: 'updated-tag',
      };

      const result = await service.update(1, updateDto);

      expect(result.name).toBe('Updated Tag');
      expect(result.slug).toBe('updated-tag');
    });

    it('should apply beforeUpdate filter hook', async () => {
      const updateDto = {
        name: 'Original Name',
      };

      const modifiedDto = {
        name: 'Modified Name',
      };

      mockHookService.applyFilters = vi
        .fn()
        .mockImplementation(async (_hookName, _data) => Promise.resolve(modifiedDto));

      const mockUpdatedTag = {
        id: 1,
        ...modifiedDto,
        slug: 'tag-slug',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockUpdatedTag]);

      await service.update(1, updateDto);

      expect(mockHookService.applyFilters).toHaveBeenCalledWith(
        'tag|beforeUpdate',
        updateDto,
        expect.objectContaining({ action: 'update', id: 1 }),
      );
    });

    it('should trigger afterUpdate action hook', async () => {
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

      await service.update(1, updateDto);

      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'tag|afterUpdate',
        expect.objectContaining({
          id: 1,
          name: 'Updated Tag',
        }),
        expect.objectContaining({
          id: 1,
          name: 'Updated Tag',
        }),
      );
    });

    it('should throw NotFoundException when tag not found', async () => {
      // Mock the complete chain for update
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a tag', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should trigger beforeDelete action hook', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await service.remove(1);

      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'tag|beforeDelete',
        { id: 1 },
        expect.objectContaining({ action: 'delete' }),
      );
    });

    it('should trigger afterDelete action hook', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await service.remove(1);

      expect(mockHookService.doAction).toHaveBeenCalledWith('tag|afterDelete', { id: 1 });
    });

    it('should throw NotFoundException when tag not found', async () => {
      // Mock the complete chain for delete
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should call hooks in correct order', async () => {
      const hookCalls: string[] = [];

      mockHookService.doAction = vi.fn().mockImplementation((hookName) => {
        hookCalls.push(hookName);
        return Promise.resolve();
      });

      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await service.remove(1);

      expect(hookCalls).toEqual(['tag|beforeDelete', 'tag|afterDelete']);
    });
  });

  describe('getStatistics', () => {
    it('should return overall statistics', async () => {
      const mockStats = {
        totalCategories: 5,
        totalTags: 10,
        totalArticles: 50,
        publishedArticles: 45,
        privateArticles: 3,
        hiddenArticles: 2,
        totalViews: 1000,
        categories: [],
        tags: [],
      };

      mockStatisticsService.getOverallStatistics.mockResolvedValueOnce(mockStats);

      const result = await service.getStatistics();

      expect(result).toBeDefined();
      expect(result.totalTags).toBe(10);
      expect(result.totalArticles).toBe(50);
      expect(mockStatisticsService.getOverallStatistics).toHaveBeenCalled();
    });
  });

  describe('findByName', () => {
    it('should return tag when found', async () => {
      const mockTag = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockTag]);

      const result = await service.findByName('Technology');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Technology');
      expect(result?.id).toBe(1);
    });

    it('should return null when tag not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.findByName('NonExistent');

      expect(result).toBeNull();
    });

    it('should handle tags with null slug', async () => {
      const mockTag = {
        id: 1,
        name: 'TestTag',
        slug: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockTag]);

      const result = await service.findByName('TestTag');

      expect(result).toBeDefined();
      expect(result?.slug).toBeUndefined();
    });
  });
});
