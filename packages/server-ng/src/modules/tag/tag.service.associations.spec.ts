/**
 * TagService - Association Queries Tests
 *
 * Tests tag associations with articles and categories.
 * Covers findOrCreateTags and getTagsWithCategories methods.
 *
 * Related tests:
 * - tag.service.spec.ts - Core CRUD operations
 * - tag.service.queries.spec.ts - Complex article queries
 * - tag.service.boundaries.spec.ts - Boundary conditions
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { tags, articleTags, articles } from '@vanblog/shared/drizzle';
import { faker } from '@faker-js/faker';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import { db } from '@test/setup.unit';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { Mock } from '@test/mock';
import { Given } from '@test/given';

import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';

import { TagService } from './tag.service';

describe('TagService - Associations', () => {
  let service: TagService;
  let mockHookService: ReturnType<typeof Mock.hook>;
  let mockQueryOptimizer: any;
  let mockStatisticsService: any;

  // 辅助函数：创建使用事务数据库的服务实例
  const createServiceWithTx = (tx: any) => {
    return new TagService(
      tx,
      mockStatisticsService,
      mockQueryOptimizer,
      mockHookService,
    );
  };

  beforeEach(async () => {
    // 创建 Mock 服务
    mockHookService = Mock.hook();
    mockQueryOptimizer = {
      batchCountArticlesByTags: vi.fn().mockResolvedValue({}),
      withPerformanceMonitoring: vi.fn().mockImplementation(async (_name, fn) => fn()),
    };
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
  });

  describe('findOrCreateTags', () => {
    it('should return existing tags without creating new ones', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // Given: 创建已存在的标签
        const existingTag1 = await Given.tag(tx, { name: 'Tag1' });
        const existingTag2 = await Given.tag(tx, { name: 'Tag2' });

        // When: 查找已存在的标签
        const result = await txService.findOrCreateTags(['Tag1', 'Tag2']);

        // Then: 应该返回已存在的标签，不应该创建新标签
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('Tag1');
        expect(result[1].name).toBe('Tag2');

        // 验证没有额外的标签被创建
        const allTags = await tx.select().from(tags);
        expect(allTags).toHaveLength(2);
      });
    });

    it('should create missing tags', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // Given: 创建一个已存在的标签
        await Given.tag(tx, { name: 'ExistingTag' });

        // When: 查找混合的标签（一个存在，一个不存在）
        const result = await txService.findOrCreateTags(['ExistingTag', 'NewTag']);

        // Then: 应该返回两个标签，已存在的和新创建的
        expect(result).toHaveLength(2);
        expect(result.some((t) => t.name === 'ExistingTag')).toBe(true);
        expect(result.some((t) => t.name === 'NewTag')).toBe(true);
      });
    });

    it('should create all tags when none exist', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // When: 查找不存在的标签
        const result = await txService.findOrCreateTags(['NewTag1', 'NewTag2']);

        // Then: 应该创建所有标签
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('NewTag1');
        expect(result[1].name).toBe('NewTag2');
      });
    });

    it('should handle empty tag name array', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // When: 查找空数组
        const result = await txService.findOrCreateTags([]);

        // Then: 应该返回空数组
        expect(result).toHaveLength(0);
      });
    });

    it('should be idempotent - calling twice should not create duplicates', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // When: 两次调用 findOrCreateTags
        const result1 = await txService.findOrCreateTags(['UniqueTag']);
        const result2 = await txService.findOrCreateTags(['UniqueTag']);

        // Then: 两次结果应该相同，不应该有重复
        expect(result1).toHaveLength(1);
        expect(result2).toHaveLength(1);
        expect(result1[0].id).toBe(result2[0].id);

        const allTags = await tx.select().from(tags);
        expect(allTags).toHaveLength(1);
      });
    });
  });

  describe('getTagsWithCategories', () => {
    it('should return tags with their category usage', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // Given: 创建测试数据
        const category1 = await Given.category(tx, { name: 'Tech' });
        const category2 = await Given.category(tx, { name: 'Lifestyle' });

        const tag1 = await Given.tag(tx, { name: 'JavaScript' });
        const tag2 = await Given.tag(tx, { name: 'React' });

        // 创建文章
        const article1 = await Given.article(tx, { categoryId: category1.id });
        const article2 = await Given.article(tx, { categoryId: category1.id });
        const article3 = await Given.article(tx, { categoryId: category2.id });

        // 关联标签到文章
        await tx.insert(articleTags).values([
          { articleId: article1.id, tagName: tag1.name, createdAt: new Date().toISOString() },
          { articleId: article2.id, tagName: tag1.name, createdAt: new Date().toISOString() },
          { articleId: article2.id, tagName: tag2.name, createdAt: new Date().toISOString() },
          { articleId: article3.id, tagName: tag2.name, createdAt: new Date().toISOString() },
        ]);

        // When: 获取标签和分类统计
        const result = await txService.getTagsWithCategories();

        // Then: 验证结果（使用 find 因为数据库可能有其他标签）
        const tag1Result = result.find((t) => t.tag.name === 'JavaScript');
        expect(tag1Result).toBeDefined();
        expect(tag1Result!.categories).toHaveLength(1); // Tech: 2 articles
        expect(tag1Result!.categories[0].name).toBe('Tech');
        expect(tag1Result!.categories[0].count).toBe(2);

        const tag2Result = result.find((t) => t.tag.name === 'React');
        expect(tag2Result).toBeDefined();
        expect(tag2Result!.categories).toHaveLength(2); // Tech: 1, Lifestyle: 1
      });
    });

    it('should return empty categories for unused tags', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // Given: 创建一个未使用的标签
        await Given.tag(tx, { name: 'UnusedTag' });

        // When: 获取标签和分类统计
        const result = await txService.getTagsWithCategories();

        // Then: 未使用的标签应该有空分类数组
        const unusedTagResult = result.find((t) => t.tag.name === 'UnusedTag');
        expect(unusedTagResult).toBeDefined();
        expect(unusedTagResult!.categories).toHaveLength(0);
      });
    });

    it('should handle multiple categories per tag correctly', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // Given: 创建跨多个分类的标签
        const categories = await Promise.all([
          Given.category(tx, { name: 'Cat1' }),
          Given.category(tx, { name: 'Cat2' }),
          Given.category(tx, { name: 'Cat3' }),
        ]);

        const tag = await Given.tag(tx, { name: 'MultiCatTag' });

        // 为每个分类创建文章并关联标签
        for (const category of categories) {
          const article = await Given.article(tx, { categoryId: category.id });
          await tx.insert(articleTags).values([
            {
              articleId: article.id,
              tagName: tag.name,
              createdAt: new Date().toISOString(),
            },
          ]);
        }

        // When: 获取标签和分类统计
        const result = await txService.getTagsWithCategories();

        // Then: 标签应该出现在所有 3 个分类中
        const tagResult = result.find((t) => t.tag.name === 'MultiCatTag');
        expect(tagResult).toBeDefined();
        expect(tagResult!.categories).toHaveLength(3);
      });
    });

    it('should return empty array when no tags exist', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // When: 获取标签和分类统计（没有标签）
        const result = await txService.getTagsWithCategories();

        // Then: 应该返回空数组
        expect(result).toHaveLength(0);
      });
    });
  });
});
