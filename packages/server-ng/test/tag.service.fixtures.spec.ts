import { NotFoundException } from '@nestjs/common';
import { describe, expect, vi } from 'vitest';

import { TagService } from '../src/modules/tag/tag.service';

import { test } from './vitest-fixtures.test';

import type { QueryOptimizerService } from '../src/shared/services/query-optimizer.service';
import type { StatisticsService } from '../src/shared/services/statistics.service';

interface TagTestContext {
  tagService: TagService;
  statisticsService: StatisticsService;
  queryOptimizerService: QueryOptimizerService;
  hookService: any;
}

const tagTest = test.extend<TagTestContext>({
  statisticsService: async (_, use) => {
    const mockService = {} as any;
    await use(mockService);
  },
  queryOptimizerService: async (_, use) => {
    const mockService = {
      withPerformanceMonitoring: vi.fn().mockImplementation(async (_name, fn) => await fn()),
      batchCountArticlesByTags: vi.fn().mockResolvedValue(new Map()),
      batchCountArticlesByCategories: vi.fn().mockResolvedValue(new Map()),
      buildOptimizedSearchQuery: vi.fn().mockReturnValue([]),
      logSlowQuery: vi.fn(),
    } as any;
    await use(mockService);
  },
  hookService: async (_, use) => {
    const mockService = {
      addAction: vi.fn(),
      addFilter: vi.fn(),
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      doAction: vi.fn().mockResolvedValue(undefined),
      applyFilters: vi.fn().mockImplementation(async (_, value) => Promise.resolve(value)),
      hasAction: vi.fn().mockReturnValue(false),
      hasFilter: vi.fn().mockReturnValue(false),
      getActionCount: vi.fn().mockReturnValue(0),
      getFilterCount: vi.fn().mockReturnValue(0),
    } as any;
    await use(mockService);
  },
  tagService: async (
    { databaseMock, statisticsService, queryOptimizerService, hookService },
    use,
  ) => {
    const service = new TagService(
      databaseMock.db as any,
      statisticsService,
      queryOptimizerService,
      hookService,
    );
    await use(service);
  },
});

describe('TagService', () => {
  describe('findAll', () => {
    tagTest(
      'should return paginated tags',
      async ({ tagService, databaseMock, queryOptimizerService }) => {
        const mockTags = [
          {
            id: 1,
            name: 'Tag 1',
            slug: 'tag-1',
            description: 'Description 1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 2,
            name: 'Tag 2',
            slug: 'tag-2',
            description: 'Description 2',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        // 设置查询结果：第一个查询返回标签
        databaseMock.setQueryResult(mockTags);

        // Mock article counts for tags
        const articleCounts = { 'Tag 1': 5, 'Tag 2': 3 };
        (queryOptimizerService.batchCountArticlesByTags as any).mockResolvedValueOnce(
          articleCounts,
        );

        // 为文章数量查询设置结果
        const mockDb = databaseMock.db;
        let countCallCount = 0;
        mockDb.select.mockImplementation(() => {
          if (countCallCount === 0) {
            countCallCount++;
            return {
              from: vi.fn().mockReturnThis(),
              then: (resolve: (value: unknown) => void) => {
                resolve(mockTags);
              },
            };
          } else {
            return {
              from: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              then: (resolve: (value: unknown) => void) => {
                resolve([{ count: 3 }]);
              },
            };
          }
        });

        const result = await tagService.findAll();

        expect(result.items).toHaveLength(2);
        expect(result.total).toBe(2);
      },
    );
  });

  describe('findOne', () => {
    tagTest('should return a tag by id', async ({ tagService, databaseMock }) => {
      const mockTag = { id: 1, name: 'Tag 1', slug: 'tag-1', description: 'Description 1' };

      databaseMock.setQueryResult([mockTag]);

      const result = await tagService.findOne(1);

      expect(result).toEqual(mockTag);
    });

    tagTest(
      'should throw NotFoundException when tag not found',
      async ({ tagService, databaseMock }) => {
        databaseMock.setQueryResult([]);

        await expect(tagService.findOne(999)).rejects.toThrow(NotFoundException);
      },
    );
  });

  describe('create', () => {
    tagTest('should create a new tag', async ({ tagService, databaseMock }) => {
      const tagData = { name: 'New Tag', description: 'New Description' };
      const mockCreatedTag = {
        id: 1,
        name: 'New Tag',
        slug: 'new-tag',
        description: 'New Description',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setInsertResult([mockCreatedTag]);

      const result = await tagService.create(tagData);

      expect(result).toMatchObject({
        id: 1,
        name: 'New Tag',
        slug: 'new-tag',
        description: 'New Description',
      });
    });
  });

  describe('update', () => {
    tagTest('should update an existing tag', async ({ tagService, databaseMock }) => {
      const updateData = { name: 'Updated Tag', description: 'Updated Description' };
      const mockUpdatedTag = {
        id: 1,
        name: 'Updated Tag',
        slug: 'updated-tag',
        description: 'Updated Description',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setUpdateResult([mockUpdatedTag]);

      const result = await tagService.update(1, updateData);

      expect(result).toEqual(mockUpdatedTag);
    });

    tagTest(
      'should throw NotFoundException when tag not found',
      async ({ tagService, databaseMock }) => {
        const updateData = { name: 'Updated Tag' };

        databaseMock.setUpdateResult([]);

        await expect(tagService.update(999, updateData)).rejects.toThrow(NotFoundException);
      },
    );
  });

  describe('remove', () => {
    tagTest('should remove a tag', async ({ tagService, databaseMock }) => {
      databaseMock.setDeleteResult([{ id: 1 }]);

      await expect(tagService.remove(1)).resolves.not.toThrow();
    });

    tagTest(
      'should throw NotFoundException when tag not found',
      async ({ tagService, databaseMock }) => {
        databaseMock.setDeleteResult([]);

        await expect(tagService.remove(999)).rejects.toThrow(NotFoundException);
      },
    );
  });

  describe('getTagsWithCategories', () => {
    tagTest('should return tags with their categories', async ({ tagService, databaseMock }) => {
      const mockTags = [
        {
          id: 1,
          name: 'Tag 1',
          slug: 'tag-1',
          description: 'Description 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'Tag 2',
          slug: 'tag-2',
          description: 'Description 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock the initial tag query
      databaseMock.setQueryResult(mockTags);

      const result = await tagService.getTagsWithCategories();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });
});
