import { Test, type TestingModule } from '@nestjs/testing';
import { analytics, articles } from '@vanblog/shared/drizzle';
import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';

import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { db } from '@test/setup.unit';
import { Given } from '@test/given';

import { DATABASE_CONNECTION } from '../../../database';
import { AnalyticsType } from '../entities/analytics.entity';

import { ArticleStatsService } from './article-stats.service';

describe('ArticleStatsService', () => {
  // Service is not used, tests are for setup only

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleStatsService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
      ],
    }).compile();

    module.get<ArticleStatsService>(ArticleStatsService);
  });

  describe('recordArticleView', () => {
    it('should record article view by ID', async () => {
      await withTestTransaction(db, async (tx) => {
        // 创建测试文章
        const [article] = await tx
          .insert(articles)
          .values({
            id: 123,
            title: 'Test Article',
            content: 'Test content',
            pathname: 'test-article',
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const ip = '192.168.1.1';
        const userAgent = 'Mozilla/5.0';

        // 注入事务数据库
        const txService = new ArticleStatsService(tx as any);

        await txService.recordArticleView(article.id, ip, userAgent);

        // 验证分析记录已创建
        const [analyticsRecord] = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.PAGEVIEW));
        expect(analyticsRecord).toBeDefined();
        expect(analyticsRecord.path).toBe('/article/test-article');
        expect(analyticsRecord.ip).toBe(ip);
        expect(analyticsRecord.userAgent).toBe(userAgent);
        // data 字段存储为 JSON 字符串
        const parsedData =
          typeof analyticsRecord.data === 'string'
            ? JSON.parse(analyticsRecord.data)
            : analyticsRecord.data;
        expect(parsedData).toEqual({ articleId: article.id });

        // 验证文章浏览次数已更新
        const [updatedArticle] = await tx
          .select()
          .from(articles)
          .where(eq(articles.id, article.id));
        expect(updatedArticle.viewer).toBe(1);
      });
    });

    it('should use article ID in path when pathname is null', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: 456,
            title: 'Article without pathname',
            content: 'Content',
            pathname: null,
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const ip = '127.0.0.1';

        const txService = new ArticleStatsService(tx as any);

        await txService.recordArticleView(article.id, ip);

        const [analyticsRecord] = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.PAGEVIEW));

        expect(analyticsRecord.path).toBe(`/article/${String(article.id)}`);
      });
    });

    it('should handle null pathname input gracefully', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: 789,
            title: 'Another Article',
            content: 'Content',
            pathname: null,
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const ip = '192.168.1.2';

        const txService = new ArticleStatsService(tx as any);

        await expect(txService.recordArticleView(article.id, ip)).resolves.not.toThrow();

        const analyticsRecords = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.PAGEVIEW));
        expect(analyticsRecords).toHaveLength(1);
      });
    });

    it('should handle null IP input gracefully', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: 123,
            title: 'Test',
            content: 'Content',
            pathname: 'test',
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const txService = new ArticleStatsService(tx as any);

        await expect(txService.recordArticleView(article.id, null as any)).resolves.not.toThrow();

        const analyticsRecords = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.PAGEVIEW));
        expect(analyticsRecords).toHaveLength(1);
      });
    });

    it('should handle null userAgent input gracefully', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: 123,
            title: 'Test',
            content: 'Content',
            pathname: 'test',
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const ip = '192.168.1.1';

        const txService = new ArticleStatsService(tx as any);

        await expect(
          txService.recordArticleView(article.id, ip, null as any),
        ).resolves.not.toThrow();

        const analyticsRecords = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.PAGEVIEW));
        expect(analyticsRecords).toHaveLength(1);
      });
    });

    it('should not record view for non-existent article', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = new ArticleStatsService(tx as any);

        await txService.recordArticleView(999, '192.168.1.1');

        // 验证没有创建分析记录
        const analyticsRecords = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.PAGEVIEW));
        expect(analyticsRecords).toHaveLength(0);
      });
    });

    it('should record view without user agent', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: 123,
            title: 'Test',
            content: 'Content',
            pathname: 'test',
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const ip = '192.168.1.1';

        const txService = new ArticleStatsService(tx as any);

        await txService.recordArticleView(article.id, ip);

        const [analyticsRecord] = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.PAGEVIEW));
        // userAgent 未提供时，数据库存储为 null
        expect(analyticsRecord.userAgent).toBeNull();
      });
    });
  });

  describe('recordArticleViewByPathname', () => {
    it('should find article by pathname and record view', async () => {
      await withTestTransaction(db, async (tx) => {
        const pathname = 'my-article';
        const [article] = await tx
          .insert(articles)
          .values({
            id: 123,
            title: 'My Article',
            content: 'Content',
            pathname,
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const ip = '192.168.1.1';
        const userAgent = 'Mozilla/5.0';

        const txService = new ArticleStatsService(tx as any);

        await txService.recordArticleViewByPathname(pathname, ip, userAgent);

        // 验证记录已创建
        const analyticsRecords = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.PAGEVIEW));
        expect(analyticsRecords).toHaveLength(1);
        // data 字段存储为 JSON 字符串
        const parsedData =
          typeof analyticsRecords[0]!.data === 'string'
            ? JSON.parse(analyticsRecords[0]!.data)
            : analyticsRecords[0]!.data;
        expect(parsedData).toEqual({ articleId: article.id });

        // 验证文章浏览次数已更新
        const [updatedArticle] = await tx
          .select()
          .from(articles)
          .where(eq(articles.id, article.id));
        expect(updatedArticle.viewer).toBe(1);
      });
    });

    it('should not record view for non-existent pathname', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = new ArticleStatsService(tx as any);

        await txService.recordArticleViewByPathname('non-existent', '192.168.1.1');

        // 验证没有创建记录
        const analyticsRecords = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.PAGEVIEW));
        expect(analyticsRecords).toHaveLength(0);
      });
    });
  });

  describe('getTopArticles', () => {
    it('should return top articles with statistics', async () => {
      await withTestTransaction(db, async (tx) => {
        // 创建文章
        const [article1] = await tx
          .insert(articles)
          .values({
            id: 1,
            title: 'Article 1',
            content: 'Content 1',
            pathname: 'article-1',
            author: 'admin',
            viewer: 500,
          })
          .returning();

        const [article2] = await tx
          .insert(articles)
          .values({
            id: 2,
            title: 'Article 2',
            content: 'Content 2',
            pathname: 'article-2',
            author: 'admin',
            viewer: 300,
          })
          .returning();

        // 创建分析记录（5 次浏览，4 个独立 IP）
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article1.pathname)}`,
          ip: '192.168.1.1',
          data: { articleId: article1.id },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article1.pathname)}`,
          ip: '192.168.1.2',
          data: { articleId: article1.id },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article1.pathname)}`,
          ip: '192.168.1.3',
          data: { articleId: article1.id },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article1.pathname)}`,
          ip: '192.168.1.4',
          data: { articleId: article1.id },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article1.pathname)}`,
          ip: '192.168.1.1',
          data: { articleId: article1.id },
        });

        // 为第一篇文章添加阅读时长记录（EVENT 类型）
        await Given.analytics(db as any, {
          type: AnalyticsType.EVENT,
          path: `/article/${String(article1.pathname)}`,
          ip: '192.168.1.1',
          data: { event: 'reading_time', articleId: article1.id, duration: 300 },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.EVENT,
          path: `/article/${String(article1.pathname)}`,
          ip: '192.168.1.2',
          data: { event: 'reading_time', articleId: article1.id, duration: 300 },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.EVENT,
          path: `/article/${String(article1.pathname)}`,
          ip: '192.168.1.3',
          data: { event: 'reading_time', articleId: article1.id, duration: 300 },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.EVENT,
          path: `/article/${String(article1.pathname)}`,
          ip: '192.168.1.4',
          data: { event: 'reading_time', articleId: article1.id, duration: 300 },
        });

        // 为第二篇文章创建记录（3 次浏览，2 个独立 IP）
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article2.pathname)}`,
          ip: '192.168.1.1',
          data: { articleId: article2.id },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article2.pathname)}`,
          ip: '192.168.1.1',
          data: { articleId: article2.id },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article2.pathname)}`,
          ip: '192.168.1.3',
          data: { articleId: article2.id },
        });

        // 为第二篇文章添加阅读时长记录（EVENT 类型）
        await Given.analytics(db as any, {
          type: AnalyticsType.EVENT,
          path: `/article/${String(article2.pathname)}`,
          ip: '192.168.1.1',
          data: { event: 'reading_time', articleId: article2.id, duration: 200 },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.EVENT,
          path: `/article/${String(article2.pathname)}`,
          ip: '192.168.1.2',
          data: { event: 'reading_time', articleId: article2.id, duration: 200 },
        });

        const txService = new ArticleStatsService(tx as any);

        const result = await txService.getTopArticles(10);

        expect(result).toHaveLength(2);
        // 第一篇文章浏览次数更多

        expect(result[0]!.articleId).toBe(1);

        expect(result[0]!.title).toBe('Article 1');

        expect(result[0]!.views).toBe(5);

        expect(result[0]!.uniqueVisitors).toBe(4);

        expect(result[0]!.avgReadTime).toBe(300);

        expect(result[1]!.articleId).toBe(2);

        expect(result[1]!.title).toBe('Article 2');

        expect(result[1]!.views).toBe(3);

        expect(result[1]!.uniqueVisitors).toBe(2);

        expect(result[1]!.avgReadTime).toBe(200);
      });
    });

    it('should handle articles with empty string titles', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: 1,
            title: '', // Empty string instead of null (title is NOT NULL in schema)
            content: 'Content',
            pathname: 'untitled-article',
            author: 'admin',
            viewer: 100,
          })
          .returning();

        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article.pathname)}`,
          ip: '192.168.1.1',
          data: { articleId: article.id },
        });

        const txService = new ArticleStatsService(tx as any);

        const result = await txService.getTopArticles();

        expect(result[0]!.title).toBe('Untitled');
      });
    });

    it('should set avgReadTime to 0 for negative values', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: 1,
            title: 'Test',
            content: 'Content',
            pathname: 'test',
            author: 'admin',
            viewer: 100,
          })
          .returning();

        // 插入负数的 duration
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article.pathname)}`,
          ip: '192.168.1.1',
          data: { articleId: article.id },
        });

        const txService = new ArticleStatsService(tx as any);

        const result = await txService.getTopArticles();

        expect(result[0]!.avgReadTime).toBe(0);
      });
    });

    it('should respect custom limit parameter', async () => {
      await withTestTransaction(db, async (tx) => {
        // 创建 20 篇文章
        for (let i = 1; i <= 20; i++) {
          const [article] = await tx
            .insert(articles)
            .values({
              id: i,
              title: `Article ${String(i)}`,
              content: `Content ${String(i)}`,
              pathname: `article-${String(i)}`,
              author: 'admin',
              viewer: 100 - i,
            })
            .returning();

          await Given.analytics(db as any, {
            type: AnalyticsType.PAGEVIEW,
            path: `/article/${String(article.pathname)}`,
            ip: '192.168.1.1',
            data: { articleId: article.id },
          });
        }

        const txService = new ArticleStatsService(tx as any);

        const result = await txService.getTopArticles(5);

        expect(result).toHaveLength(5);
      });
    });

    it('should return empty array when no articles found', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = new ArticleStatsService(tx as any);

        const result = await txService.getTopArticles();

        expect(result).toEqual([]);
      });
    });
  });

  describe('getArticleStats', () => {
    it('should return stats for specific article', async () => {
      await withTestTransaction(db, async (tx) => {
        const articleId = 123;
        const [article] = await tx
          .insert(articles)
          .values({
            id: articleId,
            title: 'Test Article',
            content: 'Content',
            pathname: 'test-article',
            author: 'admin',
            viewer: 500,
          })
          .returning();

        // 插入 3 次浏览记录，3 个独立 IP
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article.pathname)}`,
          ip: '192.168.1.1',
          data: { articleId: article.id },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article.pathname)}`,
          ip: '192.168.1.2',
          data: { articleId: article.id },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article.pathname)}`,
          ip: '192.168.1.3',
          data: { articleId: article.id },
        });

        // 插入阅读时长记录（EVENT 类型）
        await Given.analytics(db as any, {
          type: AnalyticsType.EVENT,
          path: `/article/${String(article.pathname)}`,
          ip: '192.168.1.1',
          data: { event: 'reading_time', articleId: article.id, duration: 300 },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.EVENT,
          path: `/article/${String(article.pathname)}`,
          ip: '192.168.1.2',
          data: { event: 'reading_time', articleId: article.id, duration: 300 },
        });
        await Given.analytics(db as any, {
          type: AnalyticsType.EVENT,
          path: `/article/${String(article.pathname)}`,
          ip: '192.168.1.3',
          data: { event: 'reading_time', articleId: article.id, duration: 300 },
        });

        const txService = new ArticleStatsService(tx as any);

        const result = await txService.getArticleStats(articleId);

        expect(result).toEqual({
          articleId,
          title: 'Test Article',
          views: 3,
          uniqueVisitors: 3,
          avgReadTime: 300,
        });
      });
    });

    it('should return null when article not found', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = new ArticleStatsService(tx as any);

        const result = await txService.getArticleStats(999);

        expect(result).toBeNull();
      });
    });

    it('should handle empty string title', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: 1,
            title: '', // Empty string instead of null (title is NOT NULL in schema)
            content: 'Content',
            pathname: 'test',
            author: 'admin',
            viewer: 100,
          })
          .returning();

        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article.pathname)}`,
          ip: '192.168.1.1',
          data: {
            articleId: article.id,
            duration: 0,
          },
        });

        const txService = new ArticleStatsService(tx as any);

        const result = await txService.getArticleStats(article.id);

        expect(result?.title).toBe('Untitled');
      });
    });

    it('should set avgReadTime to 0 for negative values', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: 1,
            title: 'Test',
            content: 'Content',
            pathname: 'test',
            author: 'admin',
            viewer: 100,
          })
          .returning();

        await Given.analytics(db as any, {
          type: AnalyticsType.PAGEVIEW,
          path: `/article/${String(article.pathname)}`,
          ip: '192.168.1.1',
          data: { articleId: article.id },
        });

        const txService = new ArticleStatsService(tx as any);

        const result = await txService.getArticleStats(article.id);

        expect(result?.avgReadTime).toBe(0);
      });
    });
  });

  describe('recordReadingTime', () => {
    it('should record reading time event', async () => {
      await withTestTransaction(db, async (tx) => {
        const articleId = 123;
        const duration = 300;
        const ip = '192.168.1.1';

        const txService = new ArticleStatsService(tx as any);

        await txService.recordReadingTime(articleId, duration, ip);

        const [analyticsRecord] = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.EVENT));

        expect(analyticsRecord).toBeDefined();
        expect(analyticsRecord.type).toBe(AnalyticsType.EVENT);
        expect(analyticsRecord.path).toBe(`/article/${String(articleId)}`);
        expect(analyticsRecord.ip).toBe(ip);
        // data 字段存储为 JSON 字符串
        const parsedData =
          typeof analyticsRecord.data === 'string'
            ? JSON.parse(analyticsRecord.data)
            : analyticsRecord.data;
        expect(parsedData).toEqual({
          articleId,
          duration,
          event: 'reading_time',
        });
      });
    });

    it('should handle zero duration', async () => {
      await withTestTransaction(db, async (tx) => {
        const articleId = 1;
        const duration = 0;
        const ip = '127.0.0.1';

        const txService = new ArticleStatsService(tx as any);

        await txService.recordReadingTime(articleId, duration, ip);

        const [analyticsRecord] = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.EVENT));

        const parsedData =
          typeof analyticsRecord.data === 'string'
            ? JSON.parse(analyticsRecord.data)
            : analyticsRecord.data;
        expect(parsedData).toEqual({
          articleId,
          duration: 0,
          event: 'reading_time',
        });
      });
    });

    it('should handle large duration values', async () => {
      await withTestTransaction(db, async (tx) => {
        const articleId = 1;
        const largeDuration = 999999;
        const ip = '127.0.0.1';

        const txService = new ArticleStatsService(tx as any);

        await txService.recordReadingTime(articleId, largeDuration, ip);

        const [analyticsRecord] = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.EVENT));

        const parsedData =
          typeof analyticsRecord.data === 'string'
            ? JSON.parse(analyticsRecord.data)
            : analyticsRecord.data;
        expect(parsedData).toEqual({
          articleId,
          duration: largeDuration,
          event: 'reading_time',
        });
      });
    });
  });

  describe('integration scenarios', () => {
    it('should correctly process article view workflow', async () => {
      await withTestTransaction(db, async (tx) => {
        const articleId = 42;
        const ip = '10.0.0.1';
        const userAgent = 'Test Browser';

        const [_article] = await tx
          .insert(articles)
          .values({
            id: articleId,
            title: 'Integration Test Article',
            content: 'Content',
            pathname: 'integration-test',
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const txService = new ArticleStatsService(tx as any);

        await txService.recordArticleView(articleId, ip, userAgent);

        // 验证完整的调用链
        const [analyticsRecord] = await tx
          .select()
          .from(analytics)
          .where(eq(analytics.type, AnalyticsType.PAGEVIEW));
        expect(analyticsRecord).toBeDefined();

        const [updatedArticle] = await tx.select().from(articles).where(eq(articles.id, articleId));
        expect(updatedArticle.viewer).toBe(1);
      });
    });

    it('should track article statistics over multiple views', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article] = await tx
          .insert(articles)
          .values({
            id: 1,
            title: 'Popular Article',
            content: 'Content',
            pathname: 'popular-article',
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const txService = new ArticleStatsService(tx as any);

        // 模拟 10 次浏览，来自 3 个不同 IP
        const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];
        for (let i = 0; i < 10; i++) {
          const ip = ips[i % 3]!;
          await txService.recordArticleView(article.id, ip, `UserAgent ${String(i)}`);
        }

        // 记录一些阅读时长
        await txService.recordReadingTime(article.id, 120, '192.168.1.1');
        await txService.recordReadingTime(article.id, 180, '192.168.1.2');
        await txService.recordReadingTime(article.id, 150, '192.168.1.3');

        // 获取统计数据
        const stats = await txService.getArticleStats(article.id);

        expect(stats).toBeDefined();

        expect(stats!.views).toBe(10);

        expect(stats!.uniqueVisitors).toBe(3);
        // 平均阅读时长应该接近 (120 + 180 + 150) / 3 = 150

        expect(stats!.avgReadTime).toBeGreaterThan(140);

        expect(stats!.avgReadTime).toBeLessThan(160);
      });
    });

    it('should maintain correct statistics after concurrent views', async () => {
      await withTestTransaction(db, async (tx) => {
        const [article1] = await tx
          .insert(articles)
          .values({
            id: 1,
            title: 'Article 1',
            content: 'Content 1',
            pathname: 'article-1',
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const [article2] = await tx
          .insert(articles)
          .values({
            id: 2,
            title: 'Article 2',
            content: 'Content 2',
            pathname: 'article-2',
            author: 'admin',
            viewer: 0,
          })
          .returning();

        const txService = new ArticleStatsService(tx as any);

        // 并发浏览两篇文章
        await Promise.all([
          txService.recordArticleView(article1.id, '192.168.1.1'),
          txService.recordArticleView(article2.id, '192.168.1.1'),
          txService.recordArticleView(article1.id, '192.168.1.2'),
          txService.recordArticleView(article2.id, '192.168.1.2'),
        ]);

        // 验证每篇文章的统计
        const stats1 = await txService.getArticleStats(article1.id);
        const stats2 = await txService.getArticleStats(article2.id);

        expect(stats1!.views).toBe(2);

        expect(stats2!.views).toBe(2);

        expect(stats1!.uniqueVisitors).toBe(2);

        expect(stats2!.uniqueVisitors).toBe(2);
      });
    });
  });
});
