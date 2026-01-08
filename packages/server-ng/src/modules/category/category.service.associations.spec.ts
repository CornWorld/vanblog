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
import { categories, articles, articleTags, tags } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import { db } from '@test/setup.unit';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { Mock } from '@test/mock';
import { Given } from '@test/given';

import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { CategoryService } from './category.service';

describe('CategoryService - Associations', () => {
  let service: CategoryService;
  let mockHookService: ReturnType<typeof Mock.hook>;
  let mockStatisticsService: any;
  let mockQueryOptimizer: any;
  let mockConfigService: any;

  // 辅助函数：创建使用事务数据库的服务实例
  const createServiceWithTx = (tx: any) => {
    return new CategoryService(
      tx,
      mockStatisticsService,
      mockQueryOptimizer,
      mockHookService,
      mockConfigService,
    );
  };

  beforeEach(async () => {
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
  });

  describe('getCategoriesWithTags', () => {
    it('should return categories with their tags', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // Given: 创建测试数据
        const category1 = await Given.category(tx, { name: 'Category1' });
        const category2 = await Given.category(tx, { name: 'Category2' });

        const tag1 = await Given.tag(tx, { name: 'tag1' });
        const tag2 = await Given.tag(tx, { name: 'tag2' });
        const tag3 = await Given.tag(tx, { name: 'tag3' });
        const tag4 = await Given.tag(tx, { name: 'tag4' });

        // 创建文章并关联标签
        const article1 = await Given.article(tx, {
          categoryId: category1.id,
        });
        const article2 = await Given.article(tx, {
          categoryId: category1.id,
        });
        const article3 = await Given.article(tx, {
          categoryId: category2.id,
        });

        // 关联标签到文章
        await tx.insert(articleTags).values([
          { articleId: article1.id, tagName: tag1.name, createdAt: new Date().toISOString() },
          { articleId: article1.id, tagName: tag2.name, createdAt: new Date().toISOString() },
          { articleId: article2.id, tagName: tag2.name, createdAt: new Date().toISOString() },
          { articleId: article2.id, tagName: tag3.name, createdAt: new Date().toISOString() },
          { articleId: article3.id, tagName: tag4.name, createdAt: new Date().toISOString() },
        ]);

        // When: 调用 getCategoriesWithTags
        const result = await txService.getCategoriesWithTags();

        // Then: 验证结果（使用 find 因为数据库可能有其他分类）
        const category1Result = result.find((c) => c.category.name === 'Category1');
        expect(category1Result).toBeDefined();
        expect(category1Result!.tags).toHaveLength(3); // tag1, tag2, tag3
        expect(category1Result!.tags.map((t) => t.name)).toContain('tag1');
        expect(category1Result!.tags.map((t) => t.name)).toContain('tag2');
        expect(category1Result!.tags.map((t) => t.name)).toContain('tag3');

        const category2Result = result.find((c) => c.category.name === 'Category2');
        expect(category2Result).toBeDefined();
        expect(category2Result!.tags).toHaveLength(1); // tag4
        expect(category2Result!.tags[0].name).toBe('tag4');
      });
    });

    it('should handle categories with no articles', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // Given: 创建一个没有文章的分类
        const emptyCategory = await Given.category(tx, { name: 'EmptyCategory' });

        // When: 调用 getCategoriesWithTags
        const result = await txService.getCategoriesWithTags();

        // Then: 验证结果（使用 find 因为数据库可能有其他分类）
        const emptyCategoryResult = result.find((c) => c.category.name === 'EmptyCategory');
        expect(emptyCategoryResult).toBeDefined();
        expect(emptyCategoryResult!.tags).toHaveLength(0);
      });
    });

    it('should handle articles with null tags', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // Given: 创建分类和文章
        const category1 = await Given.category(tx, { name: 'Category1' });
        const tag1 = await Given.tag(tx, { name: 'tag1' });

        const article1 = await Given.article(tx, {
          categoryId: category1.id,
        });
        const article2 = await Given.article(tx, {
          categoryId: category1.id,
        });

        // 只有 article2 有关联的标签
        await tx.insert(articleTags).values([
          { articleId: article2.id, tagName: tag1.name, createdAt: new Date().toISOString() },
        ]);

        // When: 调用 getCategoriesWithTags
        const result = await txService.getCategoriesWithTags();

        // Then: 验证结果（使用 find 因为数据库可能有其他分类）
        const category1Result = result.find((c) => c.category.name === 'Category1');
        expect(category1Result).toBeDefined();
        expect(category1Result!.tags).toHaveLength(1);
        expect(category1Result!.tags[0].name).toBe('tag1');
      });
    });
  });
});
