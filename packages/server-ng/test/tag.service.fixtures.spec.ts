import { NotFoundException } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
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

type TagResult = { items: Array<{ createdAt: string }>; total: number };

function isTagResult(v: unknown): v is TagResult {
  if (!v || typeof v !== 'object') return false;
  const obj = v as any;
  if (!Array.isArray(obj.items) || typeof obj.total !== 'number') return false;
  const first = obj.items[0];
  return first === undefined || typeof first.createdAt === 'string';
}

const tagTest = test.extend<TagTestContext>({
  /* eslint-disable-next-line no-empty-pattern */
  statisticsService: async ({}, use) => {
    const mockService = {} as any;
    await use(mockService);
  },
  /* eslint-disable-next-line no-empty-pattern */
  queryOptimizerService: async ({}, use) => {
    const mockService = {
      withPerformanceMonitoring: vi.fn().mockImplementation(async (_name, fn) => await fn()),
      batchCountArticlesByTags: vi.fn().mockResolvedValue(new Map()),
      batchCountArticlesByCategories: vi.fn().mockResolvedValue(new Map()),
      buildOptimizedSearchQuery: vi.fn().mockReturnValue([]),
      logSlowQuery: vi.fn(),
    } as any;
    await use(mockService);
  },
  /* eslint-disable-next-line no-empty-pattern */
  hookService: async ({}, use) => {
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
            createdAt: dayjs('2024-01-01').format(),
            updatedAt: dayjs('2024-01-01').format(),
          },
          {
            id: 2,
            name: 'Tag 2',
            slug: 'tag-2',
            description: 'Description 2',
            createdAt: dayjs('2024-01-02').format(),
            updatedAt: dayjs('2024-01-02').format(),
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

        const v: unknown = await tagService.findAll();
        if (!isTagResult(v)) throw new Error('Invalid TagResult');
        const { items } = v;

        expect(items).toHaveLength(2);
        expect(v.total).toBe(2);
        expect(items[0].createdAt).toMatch(/\d{4}-\d{2}-/);
      },
    );
  });

  describe('findOne', () => {
    tagTest('should return a tag by id', async ({ tagService, databaseMock }) => {
      const mockTag = { id: 1, name: 'Tag 1', slug: 'tag-1', description: 'Description 1' };

      databaseMock.setQueryResult([mockTag]);

      const result = await tagService.findOne(1);

      expect(result).toMatchObject(mockTag);
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
        createdAt: dayjs('2024-01-03').format(),
        updatedAt: dayjs('2024-01-03').format(),
      };

      databaseMock.setInsertResult([mockCreatedTag]);

      const result = await tagService.create(tagData);

      expect(result).toMatchObject({
        id: 1,
        name: 'New Tag',
        slug: 'new-tag',
      });
      expect(result.createdAt).toMatch(/\d{4}-\d{2}-/);
      // updatedAt is undefined in Tag entity for new tags
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
        createdAt: dayjs('2024-01-04').format(),
        updatedAt: dayjs('2024-01-04').format(),
      };

      databaseMock.setUpdateResult([mockUpdatedTag]);

      const result = await tagService.update(1, updateData);

      expect(result).toMatchObject({
        id: 1,
        name: 'Updated Tag',
        slug: 'updated-tag',
      });
      expect(result.createdAt).toMatch(/\d{4}-\d{2}-/);
      // updatedAt is undefined in Tag entity
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
          createdAt: dayjs('2024-01-05').format(),
          updatedAt: dayjs('2024-01-05').format(),
        },
        {
          id: 2,
          name: 'Tag 2',
          slug: 'tag-2',
          description: 'Description 2',
          createdAt: dayjs('2024-01-06').format(),
          updatedAt: dayjs('2024-01-06').format(),
        },
      ];

      // Mock the initial tag query
      databaseMock.setQueryResult(mockTags);

      const v: unknown = await tagService.getTagsWithCategories();
      expect(Array.isArray(v)).toBe(true);
      const list = v as Array<{ tag: { createdAt: string } }>;
      expect(list.length).toBe(2);
      const first = list[0];
      expect(first.tag.createdAt).toMatch(/\d{4}-\d{2}-/);
      // updatedAt is undefined in Tag entity
    });
  });
});
