import { Test, type TestingModule } from '@nestjs/testing';
import { analytics, articles } from '@vanblog/shared/drizzle';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../../database';
import { AnalyticsType } from '../entities/analytics.entity';

import { ArticleStatsService } from './article-stats.service';

describe('ArticleStatsService', () => {
  let service: ArticleStatsService;
  let mockDb: any;

  beforeEach(async () => {
    // 创建数据库 Mock
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleStatsService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ArticleStatsService>(ArticleStatsService);
  });

  describe('recordArticleView', () => {
    it('should record article view by ID', async () => {
      const articleId = 123;
      const ip = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      // Mock 查询文章
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: articleId, pathname: 'test-article' }]),
          }),
        }),
      });

      // Mock 插入分析记录
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      // Mock 更新文章浏览次数
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await service.recordArticleView(articleId, ip, userAgent);

      // 验证插入分析记录
      expect(mockDb.insert).toHaveBeenCalledWith(analytics);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        type: AnalyticsType.PAGEVIEW,
        path: `/article/test-article`,
        ip,
        userAgent,
        data: JSON.stringify({ articleId }),
      });

      // 验证更新文章浏览次数
      expect(mockDb.update).toHaveBeenCalledWith(articles);
    });

    it('should use article ID in path when pathname is null', async () => {
      const articleId = 456;
      const ip = '127.0.0.1';

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: articleId, pathname: null }]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await service.recordArticleView(articleId, ip);

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          path: `/article/${String(articleId)}`,
        }),
      );
    });

    it('should handle null pathname input gracefully', async () => {
      const articleId = 789;
      const ip = '192.168.1.2';

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: articleId, pathname: null }]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      // Should not throw and should handle null pathname gracefully
      await expect(service.recordArticleView(articleId, ip)).resolves.not.toThrow();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle null IP input gracefully', async () => {
      const articleId = 123;
      const ip = null as any;

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: articleId, pathname: 'test' }]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      // Should not throw and should handle null IP gracefully
      await expect(service.recordArticleView(articleId, ip)).resolves.not.toThrow();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle null userAgent input gracefully', async () => {
      const articleId = 123;
      const ip = '192.168.1.1';
      const userAgent = null as any;

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: articleId, pathname: 'test' }]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      // Should not throw and should handle null userAgent gracefully
      await expect(service.recordArticleView(articleId, ip, userAgent)).resolves.not.toThrow();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should not record view for non-existent article', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.recordArticleView(999, '192.168.1.1');

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should record view without user agent', async () => {
      const articleId = 123;
      const ip = '192.168.1.1';

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: articleId, pathname: 'test' }]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await service.recordArticleView(articleId, ip);

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: undefined,
        }),
      );
    });
  });

  describe('recordArticleViewByPathname', () => {
    it('should find article by pathname and record view', async () => {
      const pathname = 'my-article';
      const ip = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      // Mock 查询文章
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 123, pathname }]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await service.recordArticleViewByPathname(pathname, ip, userAgent);

      // 验证通过 pathname 查询文章
      expect(mockDb.select).toHaveBeenCalled();

      // 验证记录浏览
      expect(mockDb.insert).toHaveBeenCalledWith(analytics);
      expect(mockDb.update).toHaveBeenCalledWith(articles);
    });

    it('should not record view for non-existent pathname', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.recordArticleViewByPathname('non-existent', '192.168.1.1');

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('getTopArticles', () => {
    it('should return top articles with statistics', async () => {
      const mockResult = [
        {
          articleId: 1,
          title: 'Article 1',
          views: 500,
          uniqueVisitors: 250,
          avgReadTime: 300,
        },
        {
          articleId: 2,
          title: 'Article 2',
          views: 300,
          uniqueVisitors: 150,
          avgReadTime: 200,
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockResult),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getTopArticles(10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        articleId: 1,
        title: 'Article 1',
        views: 500,
        uniqueVisitors: 250,
        avgReadTime: 300,
      });
    });

    it('should handle articles with null titles', async () => {
      const mockResult = [
        {
          articleId: 1,
          title: null,
          views: 100,
          uniqueVisitors: 50,
          avgReadTime: 0,
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockResult),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getTopArticles();

      expect(result[0].title).toBe('Untitled');
    });

    it('should set avgReadTime to 0 for negative values', async () => {
      const mockResult = [
        {
          articleId: 1,
          title: 'Test',
          views: 100,
          uniqueVisitors: 50,
          avgReadTime: -10,
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockResult),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getTopArticles();

      expect(result[0].avgReadTime).toBe(0);
    });

    it('should respect custom limit parameter', async () => {
      const mockResult = Array.from({ length: 20 }, (_, i) => ({
        articleId: i + 1,
        title: `Article ${String(i + 1)}`,
        views: 100 - i,
        uniqueVisitors: 50 - i,
        avgReadTime: 200,
      }));

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockImplementation((limit) => {
                    return Promise.resolve(mockResult.slice(0, limit));
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const _result = await service.getTopArticles(5);

      expect(
        mockDb.select().from().leftJoin().where().groupBy().orderBy().limit,
      ).toHaveBeenCalledWith(5);
    });

    it('should return empty array when no articles found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getTopArticles();

      expect(result).toEqual([]);
    });
  });

  describe('getArticleStats', () => {
    it('should return stats for specific article', async () => {
      const articleId = 123;
      const mockResult = [
        {
          title: 'Test Article',
          views: 500,
          uniqueVisitors: 250,
          avgReadTime: 300,
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockResult),
            }),
          }),
        }),
      });

      const result = await service.getArticleStats(articleId);

      expect(result).toEqual({
        articleId,
        title: 'Test Article',
        views: 500,
        uniqueVisitors: 250,
        avgReadTime: 300,
      });
    });

    it('should return null when article not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await service.getArticleStats(999);

      expect(result).toBeNull();
    });

    it('should handle null title', async () => {
      const mockResult = [
        {
          title: null,
          views: 100,
          uniqueVisitors: 50,
          avgReadTime: 0,
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockResult),
            }),
          }),
        }),
      });

      const result = await service.getArticleStats(1);

      expect(result?.title).toBe('Untitled');
    });

    it('should set avgReadTime to 0 for negative values', async () => {
      const mockResult = [
        {
          title: 'Test',
          views: 100,
          uniqueVisitors: 50,
          avgReadTime: -5,
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockResult),
            }),
          }),
        }),
      });

      const result = await service.getArticleStats(1);

      expect(result?.avgReadTime).toBe(0);
    });
  });

  describe('recordReadingTime', () => {
    it('should record reading time event', async () => {
      const articleId = 123;
      const duration = 300;
      const ip = '192.168.1.1';

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      await service.recordReadingTime(articleId, duration, ip);

      expect(mockDb.insert).toHaveBeenCalledWith(analytics);
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        type: AnalyticsType.EVENT,
        path: `/article/${String(articleId)}`,
        ip,
        data: JSON.stringify({
          articleId,
          duration,
          event: 'reading_time',
        }),
      });
    });

    it('should handle zero duration', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      await service.recordReadingTime(1, 0, '127.0.0.1');

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          data: JSON.stringify({
            articleId: 1,
            duration: 0,
            event: 'reading_time',
          }),
        }),
      );
    });

    it('should handle large duration values', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const largeDuration = 999999;
      await service.recordReadingTime(1, largeDuration, '127.0.0.1');

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.stringContaining(`"duration":${String(largeDuration)}`),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should handle database errors on recordArticleView', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      await expect(service.recordArticleView(1, '127.0.0.1')).rejects.toThrow('Database error');
    });

    it('should handle database errors on insert', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1, pathname: 'test' }]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('Insert failed')),
      });

      await expect(service.recordArticleView(1, '127.0.0.1')).rejects.toThrow('Insert failed');
    });

    it('should handle database errors on getTopArticles', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockRejectedValue(new Error('Query failed')),
                }),
              }),
            }),
          }),
        }),
      });

      await expect(service.getTopArticles()).rejects.toThrow('Query failed');
    });
  });

  describe('integration scenarios', () => {
    it('should correctly process article view workflow', async () => {
      const articleId = 42;
      const ip = '10.0.0.1';
      const userAgent = 'Test Browser';

      // 设置完整的 Mock 链
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: articleId, pathname: 'integration-test' }]),
          }),
        }),
      });

      const insertMock = vi.fn().mockResolvedValue(undefined);
      mockDb.insert.mockReturnValue({
        values: insertMock,
      });

      const updateMock = vi.fn().mockResolvedValue(undefined);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: updateMock,
        }),
      });

      await service.recordArticleView(articleId, ip, userAgent);

      // 验证完整的调用链
      expect(mockDb.select).toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalled();
    });
  });
});
