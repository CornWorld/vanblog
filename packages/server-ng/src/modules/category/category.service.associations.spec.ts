/**
 * CategoryService - Associations Tests
 *
 * 测试分类关联数据查询功能：
 * - 获取分类及其标签（getCategoriesWithTags）
 * - 标签去重与合并
 * - 处理无文章的分类
 * - 处理 null 标签
 *
 * **测试策略**: 使用 afterEach cleanup（不使用 withTestTransaction）
 * 原因：复杂聚合查询需要已提交的数据才能正常工作
 * 参考：/tmp/claude-report/transaction-final-resolution.md
 *
 * @module CategoryService
 * @group associations
 */

import { articleTags } from '@vanblog/shared/drizzle';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

import { db } from '@test/setup.unit';
import { cleanupTestData } from '@test/utils/cleanup-helper';
import { Mock } from '@test/mock';
import { Given } from '@test/given';

import { CategoryService } from './category.service';

describe('CategoryService - Associations', () => {
  let service: CategoryService;
  let mockHookService: ReturnType<typeof Mock.hook>;
  let mockStatisticsService: any;
  let mockQueryOptimizer: any;
  let mockConfigService: any;

  beforeEach(() => {
    // 创建 Mock 服务
    mockHookService = Mock.hook();
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
    mockQueryOptimizer = {
      withPerformanceMonitoring: vi.fn().mockImplementation((_name, fn) => fn()),
      batchCountArticlesByTags: vi.fn().mockResolvedValue(new Map()),
      batchCountArticlesByCategories: vi.fn().mockResolvedValue(new Map()),
      buildOptimizedSearchQuery: vi.fn().mockReturnValue([]),
      logSlowQuery: vi.fn(),
    };
    mockConfigService = Mock.config({ 'jwt.secret': 'test-secret-key' });

    // 创建服务实例（使用 db 而不是 transaction）
    service = new CategoryService(
      db,
      mockStatisticsService,
      mockQueryOptimizer,
      mockHookService as any,
      mockConfigService,
    );
  });

  // Clean up test data after each test to prevent data pollution
  afterEach(async () => {
    await cleanupTestData(db);
  });

  describe('getCategoriesWithTags', () => {
    it('should return categories with their tags', async () => {
      // Given: 创建测试数据（直接使用 db，数据会被提交）
      const uniqueSuffix = Math.random().toString(36).substring(7);
      const category1 = await Given.category(db, { name: `Category1-${uniqueSuffix}` });
      const category2 = await Given.category(db, { name: `Category2-${uniqueSuffix}` });

      const tag1 = await Given.tag(db, { name: `tag1-${uniqueSuffix}` });
      const tag2 = await Given.tag(db, { name: `tag2-${uniqueSuffix}` });
      const tag3 = await Given.tag(db, { name: `tag3-${uniqueSuffix}` });
      const tag4 = await Given.tag(db, { name: `tag4-${uniqueSuffix}` });

      // 创建文章并关联标签
      const article1 = await Given.article(db, {
        category: category1.name, // 使用分类名称而不是 categoryId
      });
      const article2 = await Given.article(db, {
        category: category1.name,
      });
      const article3 = await Given.article(db, {
        category: category2.name,
      });

      // 关联标签到文章
      await db.insert(articleTags).values([
        { articleId: article1.id, tagName: tag1.name, createdAt: new Date().toISOString() },
        { articleId: article1.id, tagName: tag2.name, createdAt: new Date().toISOString() },
        { articleId: article2.id, tagName: tag2.name, createdAt: new Date().toISOString() },
        { articleId: article2.id, tagName: tag3.name, createdAt: new Date().toISOString() },
        { articleId: article3.id, tagName: tag4.name, createdAt: new Date().toISOString() },
      ]);

      // When: 调用 getCategoriesWithTags
      const result = await service.getCategoriesWithTags();

      // Then: 验证结果（使用 find 因为数据库可能有其他分类）
      const category1Result = result.find((c) => c.category.name === category1.name);
      expect(category1Result).toBeDefined();

      // 验证 category1 的标签（应该包含 tag1, tag2, tag3）

      const category1Tags = category1Result!.tags.filter((t) =>
        [tag1.name, tag2.name, tag3.name].includes(t.name),
      );
      expect(category1Tags).toHaveLength(3);
      expect(category1Tags.map((t) => t.name)).toContain(tag1.name);
      expect(category1Tags.map((t) => t.name)).toContain(tag2.name);
      expect(category1Tags.map((t) => t.name)).toContain(tag3.name);

      const category2Result = result.find((c) => c.category.name === category2.name);
      expect(category2Result).toBeDefined();

      // 验证 category2 的标签（应该只有 tag4）

      const category2Tags = category2Result!.tags.filter((t) => t.name === tag4.name);
      expect(category2Tags).toHaveLength(1);

      expect(category2Tags[0]!.name).toBe(tag4.name);
    });

    it('should handle categories with no articles', async () => {
      // Given: 创建一个没有文章的分类（使用唯一名称避免冲突）
      const uniqueSuffix = Math.random().toString(36).substring(7);
      const emptyCategory = await Given.category(db, {
        name: `EmptyCategory-${uniqueSuffix}`,
      });

      // When: 调用 getCategoriesWithTags
      const result = await service.getCategoriesWithTags();

      // Then: 验证结果（使用 find 因为数据库可能有其他分类）
      const emptyCategoryResult = result.find((c) => c.category.name === emptyCategory.name);
      expect(emptyCategoryResult).toBeDefined();

      expect(emptyCategoryResult!.tags).toHaveLength(0);
    });

    it('should handle articles with null tags', async () => {
      // Given: 创建分类和文章（使用唯一名称避免冲突）
      const uniqueSuffix = Math.random().toString(36).substring(7);
      const category1 = await Given.category(db, { name: `Category1-${uniqueSuffix}` });
      const tag1 = await Given.tag(db, { name: `tag1-${uniqueSuffix}` });

      // article1 没有标签，article2 有标签
      await Given.article(db, {
        category: category1.name,
      });
      const article2 = await Given.article(db, {
        category: category1.name,
      });

      // 只有 article2 有关联的标签
      await db
        .insert(articleTags)
        .values([
          { articleId: article2.id, tagName: tag1.name, createdAt: new Date().toISOString() },
        ]);

      // When: 调用 getCategoriesWithTags
      const result = await service.getCategoriesWithTags();

      // Then: 验证结果（使用 find 因为数据库可能有其他分类）
      const category1Result = result.find((c) => c.category.name === category1.name);
      expect(category1Result).toBeDefined();

      // 验证标签（应该只有 tag1）

      const category1Tags = category1Result!.tags.filter((t) => t.name === tag1.name);
      expect(category1Tags).toHaveLength(1);

      expect(category1Tags[0]!.name).toBe(tag1.name);
    });
  });
});
