import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { ArticleStats } from './article-stats.service';
import type { AnalyticsOverviewDto, PageRankingDto } from '../dto/analytics-response.dto';

import { AnalyticsService } from './analytics.service';
import { ArticleStatsService } from './article-stats.service';
import { PublicAnalyticsService } from './public-analytics.service';

describe('PublicAnalyticsService', () => {
  let service: PublicAnalyticsService;
  let mockAnalyticsService: any;
  let mockArticleStatsService: any;

  beforeEach(async () => {
    // 创建 AnalyticsService Mock
    mockAnalyticsService = {
      getOverview: vi.fn(),
      getPageRankings: vi.fn(),
    };

    // 创建 ArticleStatsService Mock
    mockArticleStatsService = {
      getArticleStats: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicAnalyticsService,
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
        {
          provide: ArticleStatsService,
          useValue: mockArticleStatsService,
        },
      ],
    }).compile();

    service = module.get<PublicAnalyticsService>(PublicAnalyticsService);
  });

  describe('getPublicOverview', () => {
    it('should return public overview data', async () => {
      const mockOverview: AnalyticsOverviewDto = {
        todayPageviews: 100,
        yesterdayPageviews: 80,
        totalPageviews: 1000,
        todayVisitors: 50,
        yesterdayVisitors: 40,
        totalVisitors: 500,
      };

      mockAnalyticsService.getOverview.mockResolvedValue(mockOverview);

      const result = await service.getPublicOverview();

      expect(result).toEqual({
        todayPageviews: 100,
        yesterdayPageviews: 80,
        totalPageviews: 1000,
        todayVisitors: 50,
        yesterdayVisitors: 40,
        totalVisitors: 500,
      });
      expect(mockAnalyticsService.getOverview).toHaveBeenCalledTimes(1);
    });

    it('should handle zero values', async () => {
      const mockOverview: AnalyticsOverviewDto = {
        todayPageviews: 0,
        yesterdayPageviews: 0,
        totalPageviews: 0,
        todayVisitors: 0,
        yesterdayVisitors: 0,
        totalVisitors: 0,
      };

      mockAnalyticsService.getOverview.mockResolvedValue(mockOverview);

      const result = await service.getPublicOverview();

      expect(result.todayPageviews).toBe(0);
      expect(result.totalPageviews).toBe(0);
      expect(result.todayVisitors).toBe(0);
    });

    it('should not expose any sensitive internal fields', async () => {
      const mockOverview = {
        todayPageviews: 100,
        yesterdayPageviews: 80,
        totalPageviews: 1000,
        todayVisitors: 50,
        yesterdayVisitors: 40,
        totalVisitors: 500,
        // 假设有敏感字段
        internalMetrics: { cpu: 80, memory: 1024 },
      } as any;

      mockAnalyticsService.getOverview.mockResolvedValue(mockOverview);

      const result = await service.getPublicOverview();

      expect(result).not.toHaveProperty('internalMetrics');
      expect(Object.keys(result)).toEqual([
        'todayPageviews',
        'yesterdayPageviews',
        'totalPageviews',
        'todayVisitors',
        'yesterdayVisitors',
        'totalVisitors',
      ]);
    });
  });

  describe('getPublicArticleStats', () => {
    it('should return public article stats', async () => {
      const articleId = 123;
      const mockStats: ArticleStats = {
        articleId,
        title: 'Test Article',
        views: 500,
        uniqueVisitors: 250,
        avgReadTime: 300,
      };

      mockArticleStatsService.getArticleStats.mockResolvedValue(mockStats);

      const result = await service.getPublicArticleStats(articleId);

      expect(result).toEqual({
        articleId: 123,
        title: 'Test Article',
        views: 500,
        uniqueVisitors: 250,
        avgReadTime: 300,
      });
      expect(mockArticleStatsService.getArticleStats).toHaveBeenCalledWith(articleId);
    });

    it('should return null when article stats not found', async () => {
      mockArticleStatsService.getArticleStats.mockResolvedValue(null);

      const result = await service.getPublicArticleStats(999);

      expect(result).toBeNull();
    });

    it('should handle zero statistics', async () => {
      const mockStats: ArticleStats = {
        articleId: 1,
        title: 'New Article',
        views: 0,
        uniqueVisitors: 0,
        avgReadTime: 0,
      };

      mockArticleStatsService.getArticleStats.mockResolvedValue(mockStats);

      const result = await service.getPublicArticleStats(1);

      expect(result?.views).toBe(0);
      expect(result?.uniqueVisitors).toBe(0);
      expect(result?.avgReadTime).toBe(0);
    });

    it('should not expose any additional fields from internal stats', async () => {
      const mockStats = {
        articleId: 123,
        title: 'Test',
        views: 100,
        uniqueVisitors: 50,
        avgReadTime: 200,
        // 假设有额外的内部字段
        internalData: { sensitive: 'data' },
      } as any;

      mockArticleStatsService.getArticleStats.mockResolvedValue(mockStats);

      const result = await service.getPublicArticleStats(123);

      expect(result).not.toHaveProperty('internalData');
      expect(Object.keys(result!)).toEqual([
        'articleId',
        'title',
        'views',
        'uniqueVisitors',
        'avgReadTime',
      ]);
    });
  });

  describe('getPublicPageRankings', () => {
    it('should return sanitized page rankings', async () => {
      const mockRankings: PageRankingDto[] = [
        { path: '/home', views: 500, uniqueVisitors: 250 },
        { path: '/blog', views: 300, uniqueVisitors: 150 },
        { path: '/about', views: 100, uniqueVisitors: 50 },
      ];

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings(10);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        path: '/home',
        views: 500,
      });
      expect(result[1]).toEqual({
        path: '/blog',
        views: 300,
      });
      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(10);
    });

    it('should remove query parameters from paths', async () => {
      const mockRankings: PageRankingDto[] = [
        { path: '/article?id=123&ref=twitter', views: 100, uniqueVisitors: 50 },
        { path: '/search?q=test&lang=en', views: 50, uniqueVisitors: 25 },
      ];

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings();

      expect(result[0].path).toBe('/article');
      expect(result[1].path).toBe('/search');
    });

    it('should handle paths with fragments', async () => {
      const mockRankings: PageRankingDto[] = [
        { path: '/page#section1', views: 100, uniqueVisitors: 50 },
      ];

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings();

      // URL 解析会移除 fragment
      expect(result[0].path).toBe('/page');
    });

    it('should handle invalid URL paths gracefully', async () => {
      const mockRankings: PageRankingDto[] = [
        { path: 'not-a-valid-url', views: 100, uniqueVisitors: 50 },
      ];

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings();

      // 对于无效 URL，new URL() 会将其作为路径，添加前导斜杠
      expect(result[0].path).toBe('/not-a-valid-url');
    });

    it('should handle paths with multiple query parameters', async () => {
      const mockRankings: PageRankingDto[] = [
        {
          path: '/products?category=electronics&brand=apple&color=red',
          views: 200,
          uniqueVisitors: 100,
        },
      ];

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings();

      expect(result[0].path).toBe('/products');
    });

    it('should not expose uniqueVisitors field', async () => {
      const mockRankings: PageRankingDto[] = [{ path: '/test', views: 100, uniqueVisitors: 50 }];

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings();

      expect(result[0]).not.toHaveProperty('uniqueVisitors');
      expect(result[0]).toHaveProperty('views');
      expect(result[0]).toHaveProperty('path');
    });

    it('should respect custom limit parameter', async () => {
      mockAnalyticsService.getPageRankings.mockResolvedValue([]);

      await service.getPublicPageRankings(5);

      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(5);
    });

    it('should use default limit of 10', async () => {
      mockAnalyticsService.getPageRankings.mockResolvedValue([]);

      await service.getPublicPageRankings();

      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(10);
    });

    it('should handle empty rankings array', async () => {
      mockAnalyticsService.getPageRankings.mockResolvedValue([]);

      const result = await service.getPublicPageRankings();

      expect(result).toEqual([]);
    });

    it('should handle paths with encoded characters', async () => {
      const mockRankings: PageRankingDto[] = [
        { path: '/search?q=%E4%B8%AD%E6%96%87', views: 100, uniqueVisitors: 50 },
      ];

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings();

      expect(result[0].path).toBe('/search');
    });
  });

  describe('path sanitization', () => {
    it('should remove trailing slashes after sanitization', async () => {
      const mockRankings: PageRankingDto[] = [
        { path: '/page/?param=value', views: 100, uniqueVisitors: 50 },
      ];

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings();

      expect(result[0].path).toBe('/page/');
    });

    it('should preserve root path', async () => {
      const mockRankings: PageRankingDto[] = [{ path: '/', views: 1000, uniqueVisitors: 500 }];

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings();

      expect(result[0].path).toBe('/');
    });

    it('should handle paths with only query parameters', async () => {
      const mockRankings: PageRankingDto[] = [
        { path: '?param=value', views: 50, uniqueVisitors: 25 },
      ];

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings();

      // new URL('?param=value', 'http://localhost') 返回 pathname '/'
      expect(result[0].path).toBe('/');
    });
  });

  describe('error handling', () => {
    it('should propagate errors from AnalyticsService.getOverview', async () => {
      mockAnalyticsService.getOverview.mockRejectedValue(new Error('Service error'));

      await expect(service.getPublicOverview()).rejects.toThrow('Service error');
    });

    it('should propagate errors from ArticleStatsService.getArticleStats', async () => {
      mockArticleStatsService.getArticleStats.mockRejectedValue(new Error('Stats error'));

      await expect(service.getPublicArticleStats(1)).rejects.toThrow('Stats error');
    });

    it('should propagate errors from AnalyticsService.getPageRankings', async () => {
      mockAnalyticsService.getPageRankings.mockRejectedValue(new Error('Rankings error'));

      await expect(service.getPublicPageRankings()).rejects.toThrow('Rankings error');
    });
  });

  describe('data privacy', () => {
    it('should not expose IP addresses in any public method', async () => {
      const mockOverview = {
        todayPageviews: 100,
        yesterdayPageviews: 80,
        totalPageviews: 1000,
        todayVisitors: 50,
        yesterdayVisitors: 40,
        totalVisitors: 500,
        ipAddresses: ['192.168.1.1', '10.0.0.1'], // 假设有 IP 列表
      } as any;

      mockAnalyticsService.getOverview.mockResolvedValue(mockOverview);

      const result = await service.getPublicOverview();

      expect(result).not.toHaveProperty('ipAddresses');
    });

    it('should not expose user agents in page rankings', async () => {
      const mockRankings = [
        {
          path: '/test',
          views: 100,
          uniqueVisitors: 50,
          userAgents: ['Mozilla/5.0', 'Chrome/91.0'],
        },
      ] as any;

      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);

      const result = await service.getPublicPageRankings();

      expect(result[0]).not.toHaveProperty('userAgents');
    });

    it('should not expose referrer information in article stats', async () => {
      const mockStats = {
        articleId: 1,
        title: 'Test',
        views: 100,
        uniqueVisitors: 50,
        avgReadTime: 200,
        referrers: ['https://google.com'],
      } as any;

      mockArticleStatsService.getArticleStats.mockResolvedValue(mockStats);

      const result = await service.getPublicArticleStats(1);

      expect(result).not.toHaveProperty('referrers');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete public analytics workflow', async () => {
      // 模拟完整的公开统计数据获取流程
      const mockOverview: AnalyticsOverviewDto = {
        todayPageviews: 100,
        yesterdayPageviews: 80,
        totalPageviews: 1000,
        todayVisitors: 50,
        yesterdayVisitors: 40,
        totalVisitors: 500,
      };

      const mockRankings: PageRankingDto[] = [
        { path: '/home?ref=twitter', views: 200, uniqueVisitors: 100 },
        { path: '/blog', views: 150, uniqueVisitors: 75 },
      ];

      const mockArticleStats: ArticleStats = {
        articleId: 123,
        title: 'Popular Article',
        views: 500,
        uniqueVisitors: 250,
        avgReadTime: 300,
      };

      mockAnalyticsService.getOverview.mockResolvedValue(mockOverview);
      mockAnalyticsService.getPageRankings.mockResolvedValue(mockRankings);
      mockArticleStatsService.getArticleStats.mockResolvedValue(mockArticleStats);

      // 获取所有公开数据
      const overview = await service.getPublicOverview();
      const rankings = await service.getPublicPageRankings();
      const articleStats = await service.getPublicArticleStats(123);

      // 验证数据正确性
      expect(overview.totalPageviews).toBe(1000);
      expect(rankings).toHaveLength(2);
      expect(rankings[0].path).toBe('/home'); // 查询参数已移除
      expect(articleStats?.views).toBe(500);
    });
  });
});
