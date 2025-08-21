import { NotFoundException } from '@nestjs/common';
import { describe, expect, vi } from 'vitest';

import { test } from '../../../test/vitest-fixtures.test';

import { TagService } from './tag.service';

import type { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import type { StatisticsService } from '../../shared/services/statistics.service';

// 扩展测试上下文，添加 TagService 实例
const tagTest = test.extend<{
  tagService: TagService;
  statisticsService: StatisticsService;
  queryOptimizerService: QueryOptimizerService;
}>({
  statisticsService: async (_ctx, use) => {
    const mockService = {} as any;
    await use(mockService);
  },
  queryOptimizerService: async (_ctx, use) => {
    const mockService = {
      withPerformanceMonitoring: vi.fn().mockImplementation(async (_name, fn) => await fn()),
      batchCountArticlesByTags: vi.fn().mockResolvedValue(new Map()),
      batchCountArticlesByCategories: vi.fn().mockResolvedValue(new Map()),
      buildOptimizedSearchQuery: vi.fn().mockReturnValue([]),
      logSlowQuery: vi.fn(),
    } as any;
    await use(mockService);
  },
  tagService: async ({ db, hookService, statisticsService, queryOptimizerService }, use) => {
    const service = new TagService(
      db as any,
      statisticsService as any,
      queryOptimizerService as any,
      hookService as any,
    );
    await use(service);
  },
});

describe('TagService with Vitest Fixtures', () => {
  describe('findAll', () => {
    tagTest(
      'should return all tags',
      async ({ tagService, databaseMock, queryOptimizerService }) => {
        const mockTags = [
          {
            id: 1,
            name: 'Tag1',
            slug: 'tag1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        // 设置查询结果：返回标签数组
        databaseMock.setQueryResult(mockTags);

        // Mock article counts for tags
        const articleCounts = { Tag1: 3 };
        (queryOptimizerService.batchCountArticlesByTags as any).mockResolvedValueOnce(
          articleCounts,
        );

        const result = await tagService.findAll();

        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe('Tag1');
        expect(result.items[0].articleCount).toBe(3);
        expect(result.total).toBe(1);
      },
    );
  });

  describe('findOne', () => {
    tagTest('should return a single tag', async ({ tagService, databaseMock }) => {
      const mockTag = {
        id: 1,
        name: 'Tag1',
        slug: 'tag1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([mockTag]);

      const result = await tagService.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Tag1');
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
      const mockCreatedTag = {
        id: 1,
        name: 'New Tag',
        slug: 'new-tag',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setInsertResult([mockCreatedTag]);

      const createDto = {
        name: 'New Tag',
        slug: 'new-tag',
      };

      const result = await tagService.create(createDto);

      expect(result.id).toBe(1);
      expect(result.name).toBe('New Tag');
    });
  });

  describe('update', () => {
    tagTest('should update an existing tag', async ({ tagService, databaseMock }) => {
      const mockUpdatedTag = {
        id: 1,
        name: 'Updated Tag',
        slug: 'updated-tag',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setUpdateResult([mockUpdatedTag]);

      const updateDto = {
        name: 'Updated Tag',
      };

      const result = await tagService.update(1, updateDto);

      expect(result.name).toBe('Updated Tag');
    });

    tagTest(
      'should throw NotFoundException when tag not found',
      async ({ tagService, databaseMock }) => {
        databaseMock.setUpdateResult([]);

        await expect(tagService.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
      },
    );
  });

  describe('remove', () => {
    tagTest('should delete a tag', async ({ tagService, databaseMock }) => {
      // Mock delete operation with returning result
      databaseMock.setDeleteResult([{ id: 1 }]);

      await expect(tagService.remove(1)).resolves.not.toThrow();
    });

    tagTest(
      'should throw NotFoundException when tag not found',
      async ({ tagService, databaseMock }) => {
        // Mock delete operation with empty returning result
        databaseMock.setDeleteResult([]);

        await expect(tagService.remove(999)).rejects.toThrow(NotFoundException);
      },
    );
  });

  describe('getTagsWithCategories', () => {
    tagTest('should return tags with their categories', async ({ tagService, databaseMock }) => {
      const mockTags = [
        { id: 1, name: 'Tag1', slug: 'tag1', createdAt: new Date(), updatedAt: new Date() },
        { id: 2, name: 'Tag2', slug: 'tag2', createdAt: new Date(), updatedAt: new Date() },
      ];

      const mockCategories = [
        { category: 'Category1', count: 2 },
        { category: 'Category2', count: 1 },
      ];

      // 设置查询结果：第一个查询返回标签
      databaseMock.setQueryResult(mockTags);

      // 为每个标签的分类查询设置结果
      const mockDb = databaseMock.db;
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        if (selectCallCount === 0) {
          selectCallCount++;
          // 第一次调用：获取所有标签
          return {
            from: vi.fn().mockImplementation(() => ({
              then: (resolve: (value: unknown) => void) => {
                resolve(mockTags);
              },
            })),
          };
        } else {
          // 后续调用：获取分类统计
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockImplementation(() => ({
              then: (resolve: (value: unknown) => void) => {
                resolve(mockCategories);
              },
            })),
          };
        }
      });

      const result = await tagService.getTagsWithCategories();

      expect(result).toHaveLength(2);
      expect(result[0].categories).toHaveLength(2);
      expect(result[0].categories[0].name).toBe('Category1');
      expect(result[0].categories[0].count).toBe(2);
    });
  });
});
