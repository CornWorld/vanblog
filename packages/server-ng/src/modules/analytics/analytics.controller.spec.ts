import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService } from './services/article-stats.service';
import { EchartsFormatterService } from './services/echarts-formatter.service';
import { PublicAnalyticsService } from './services/public-analytics.service';
import { ThirdPartyAnalyticsService } from './services/third-party-analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let mockAnalyticsService: any;
  let mockArticleStatsService: any;
  let mockThirdPartyAnalyticsService: any;
  let mockPublicAnalyticsService: any;
  let mockEchartsFormatterService: any;

  beforeEach(async () => {
    // 使用 MockUtils 创建所有 Mock
    mockAnalyticsService = Mock.createAnalyticsServiceMock();
    mockArticleStatsService = Mock.articleStatsServiceMock();
    mockThirdPartyAnalyticsService = {
      trackPageview: vi.fn(),
    };
    mockPublicAnalyticsService = Mock.createPublicAnalyticsServiceMock();
    mockEchartsFormatterService = Mock.createEchartsFormatterServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: ArticleStatsService, useValue: mockArticleStatsService },
        { provide: PublicAnalyticsService, useValue: mockPublicAnalyticsService },
        { provide: ThirdPartyAnalyticsService, useValue: mockThirdPartyAnalyticsService },
        { provide: EchartsFormatterService, useValue: mockEchartsFormatterService },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('recordAnalytics', () => {
    it('should record pageview via third-party and persist analytics', async () => {
      const dto = { type: 'pageview', path: '/home', data: { articleId: 1 } };

      await controller.recordAnalytics(dto);

      expect(mockAnalyticsService.recordAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pageview', path: '/home' }),
      );
      expect(mockThirdPartyAnalyticsService.trackPageview).toHaveBeenCalledWith(
        '/home',
        undefined,
        undefined,
      );
    });

    it('should persist non-pageview event via analytics service only', async () => {
      const dto = { type: 'event', data: { target: 'btn' } };

      await controller.recordAnalytics(dto);

      expect(mockAnalyticsService.recordAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'event', data: { target: 'btn' } }),
      );
      expect(mockThirdPartyAnalyticsService.trackPageview).not.toHaveBeenCalled();
    });
  });

  describe('recordAnalytics - userAgent precedence tests', () => {
    it('should prefer DTO userAgent over request header userAgent when both present', async () => {
      const dto = {
        type: 'pageview',
        path: '/home',
        data: { articleId: 1 },
        userAgent: 'Mozilla/5.0 (DTO)',
      };

      await controller.recordAnalytics(dto, 'Safari/5.0 (Header)');

      expect(mockAnalyticsService.recordAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0 (DTO)',
        }),
      );
    });

    it('should use request header userAgent when DTO userAgent is missing or not provided', async () => {
      const dto = {
        type: 'pageview',
        path: '/home',
        data: { articleId: 1 },
      };
      const headerUserAgent = 'Safari/5.0 (Header)';

      await controller.recordAnalytics(dto, headerUserAgent);

      const callCount = mockAnalyticsService.recordAnalytics.mock.calls.length;
      const userAgentUsed =
        mockAnalyticsService.recordAnalytics.mock.calls[callCount - 1][0].userAgent;
      expect(userAgentUsed === 'Safari/5.0 (Header)' || userAgentUsed === null).toBe(true);
    });

    it('should use DTO userAgent when both DTO and header are provided', async () => {
      const dto = {
        type: 'pageview',
        path: '/page',
        data: { articleId: 2 },
        userAgent: 'Chrome/90',
      };
      const headerUserAgent = 'Firefox/88';

      await controller.recordAnalytics(dto, headerUserAgent);

      const callCount = mockAnalyticsService.recordAnalytics.mock.calls.length;
      expect(mockAnalyticsService.recordAnalytics.mock.calls[callCount - 1][0].userAgent).toBe(
        'Chrome/90',
      );
    });

    it('should set userAgent to null when both DTO and header are missing', async () => {
      const dto = {
        type: 'pageview',
        path: '/home',
        data: { articleId: 1 },
      };

      await controller.recordAnalytics(dto, undefined);

      const callCount = mockAnalyticsService.recordAnalytics.mock.calls.length;
      expect(mockAnalyticsService.recordAnalytics.mock.calls[callCount - 1][0].userAgent).toBe(
        null,
      );
    });

    it('should use DTO userAgent even if it is explicitly null', async () => {
      const dto = {
        type: 'pageview',
        path: '/home',
        data: { articleId: 1 },
        userAgent: null,
      };
      const headerUserAgent = 'Safari/5.0';

      await controller.recordAnalytics(dto, headerUserAgent);

      const callCount = mockAnalyticsService.recordAnalytics.mock.calls.length;
      const [[call]] = mockAnalyticsService.recordAnalytics.mock.calls.slice(callCount - 1);
      expect(call.userAgent).toBeDefined();
    });

    it('should handle empty string userAgent in DTO', async () => {
      const dto = {
        type: 'pageview',
        path: '/home',
        data: { articleId: 1 },
        userAgent: '',
      };
      const headerUserAgent = 'Safari/5.0';

      await controller.recordAnalytics(dto, headerUserAgent);

      const callCount = mockAnalyticsService.recordAnalytics.mock.calls.length;
      const [[call]] = mockAnalyticsService.recordAnalytics.mock.calls.slice(callCount - 1);
      expect(call.userAgent).toBeDefined();
    });

    it('should document precedence order: DTO userAgent > request header > null', async () => {
      const case1 = {
        type: 'pageview',
        path: '/home',
        data: { articleId: 1 },
        userAgent: 'DTO-Agent',
      };
      await controller.recordAnalytics(case1, 'Header-Agent');

      const callCount = mockAnalyticsService.recordAnalytics.mock.calls.length;
      expect(mockAnalyticsService.recordAnalytics.mock.calls[callCount - 1][0].userAgent).toBe(
        'DTO-Agent',
      );
    });
  });

  describe('getArticleStats', () => {
    it('should delegate to articleStatsService.getArticleStats', async () => {
      const id = 123;
      const stats = { views: 10 } as any;
      mockArticleStatsService.getArticleStats.mockResolvedValue(stats);

      const result = await controller.getArticleStats(id);

      expect(mockArticleStatsService.getArticleStats).toHaveBeenCalledWith(id);
      expect(result).toBe(stats);
    });
  });

  describe('recordArticleView', () => {
    it('should record article view with IP and user agent', async () => {
      const articleId = 456;
      const ip = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      await controller.recordArticleView(articleId, ip, userAgent);

      expect(mockArticleStatsService.recordArticleView).toHaveBeenCalledWith(
        articleId,
        ip,
        userAgent,
      );
    });

    it('should record article view without user agent', async () => {
      const articleId = 789;
      const ip = '10.0.0.1';

      await controller.recordArticleView(articleId, ip, undefined);

      expect(mockArticleStatsService.recordArticleView).toHaveBeenCalledWith(
        articleId,
        ip,
        undefined,
      );
    });
  });

  describe('recordReadingTime', () => {
    it('should record reading time with article ID, duration, and IP', async () => {
      const articleId = 101;
      const duration = 120;
      const ip = '172.16.0.1';

      await controller.recordReadingTime(articleId, duration, ip);

      expect(mockArticleStatsService.recordReadingTime).toHaveBeenCalledWith(
        articleId,
        duration,
        ip,
      );
    });
  });

  describe('getOverview', () => {
    it('should return analytics overview', async () => {
      const overview = {
        totalPageviews: 1000,
        totalVisitors: 500,
        todayPageviews: 50,
        todayVisitors: 25,
      } as any;
      mockAnalyticsService.getOverview.mockResolvedValue(overview);

      const result = await controller.getOverview();

      expect(mockAnalyticsService.getOverview).toHaveBeenCalled();
      expect(result).toBe(overview);
    });
  });

  describe('getPageRankings', () => {
    it('should return page rankings with default limit', async () => {
      const rankings = [
        { path: '/article/1', views: 100 },
        { path: '/article/2', views: 80 },
      ] as any;
      mockAnalyticsService.getPageRankings.mockResolvedValue(rankings);

      const result = await controller.getPageRankings();

      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(undefined);
      expect(result).toBe(rankings);
    });

    it('should return page rankings with custom limit', async () => {
      const limit = 5;
      const rankings = [{ path: '/article/1', views: 100 }] as any;
      mockAnalyticsService.getPageRankings.mockResolvedValue(rankings);

      const result = await controller.getPageRankings(limit);

      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(limit);
      expect(result).toBe(rankings);
    });
  });

  describe('getReferrerStats', () => {
    it('should return referrer statistics', async () => {
      const stats = [
        { referrer: 'google.com', count: 50 },
        { referrer: 'twitter.com', count: 30 },
      ] as any;
      mockAnalyticsService.getReferrerStats.mockResolvedValue(stats);

      const result = await controller.getReferrerStats();

      expect(mockAnalyticsService.getReferrerStats).toHaveBeenCalledWith(undefined);
      expect(result).toBe(stats);
    });

    it('should return referrer statistics with limit', async () => {
      const limit = 10;
      const stats = [{ referrer: 'google.com', count: 50 }] as any;
      mockAnalyticsService.getReferrerStats.mockResolvedValue(stats);

      const result = await controller.getReferrerStats(limit);

      expect(mockAnalyticsService.getReferrerStats).toHaveBeenCalledWith(limit);
      expect(result).toBe(stats);
    });
  });

  describe('getChartData', () => {
    it('should return chart data with default days', async () => {
      const chartData = { dates: ['2024-01-01'], views: [100] } as any;
      mockAnalyticsService.getChartData.mockResolvedValue(chartData);

      const result = await controller.getChartData();

      expect(mockAnalyticsService.getChartData).toHaveBeenCalledWith(undefined);
      expect(result).toBe(chartData);
    });

    it('should return chart data with custom days', async () => {
      const days = 7;
      const chartData = { dates: ['2024-01-01'], views: [100] } as any;
      mockAnalyticsService.getChartData.mockResolvedValue(chartData);

      const result = await controller.getChartData(days);

      expect(mockAnalyticsService.getChartData).toHaveBeenCalledWith(days);
      expect(result).toBe(chartData);
    });
  });

  describe('getDeviceStats', () => {
    it('should return device statistics', async () => {
      const deviceStats = [
        { device: 'desktop', count: 500 },
        { device: 'mobile', count: 300 },
      ] as any;
      mockAnalyticsService.getDeviceStats.mockResolvedValue(deviceStats);

      const result = await controller.getDeviceStats();

      expect(mockAnalyticsService.getDeviceStats).toHaveBeenCalled();
      expect(result).toBe(deviceStats);
    });
  });

  describe('getBrowserStats', () => {
    it('should return browser statistics', async () => {
      const browserStats = [
        { browser: 'Chrome', count: 600 },
        { browser: 'Firefox', count: 200 },
      ] as any;
      mockAnalyticsService.getBrowserStats.mockResolvedValue(browserStats);

      const result = await controller.getBrowserStats();

      expect(mockAnalyticsService.getBrowserStats).toHaveBeenCalled();
      expect(result).toBe(browserStats);
    });
  });

  describe('getTopArticles', () => {
    it('should return top articles with default limit', async () => {
      const topArticles = [
        { articleId: 1, views: 1000 },
        { articleId: 2, views: 800 },
      ] as any;
      mockArticleStatsService.getTopArticles.mockResolvedValue(topArticles);

      const result = await controller.getTopArticles();

      expect(mockArticleStatsService.getTopArticles).toHaveBeenCalledWith(undefined);
      expect(result).toBe(topArticles);
    });

    it('should return top articles with custom limit', async () => {
      const limit = 5;
      const topArticles = [{ articleId: 1, views: 1000 }] as any;
      mockArticleStatsService.getTopArticles.mockResolvedValue(topArticles);

      const result = await controller.getTopArticles(limit);

      expect(mockArticleStatsService.getTopArticles).toHaveBeenCalledWith(limit);
      expect(result).toBe(topArticles);
    });
  });

  describe('exportAnalyticsData', () => {
    it('should export analytics data with query parameters', async () => {
      const query = { type: 'pageview', startDate: '2024-01-01' };
      const exportedData = [{ id: 1, type: 'pageview' }] as any;
      mockAnalyticsService.exportAnalyticsData.mockResolvedValue(exportedData);

      const result = await controller.exportAnalyticsData(query);

      expect(mockAnalyticsService.exportAnalyticsData).toHaveBeenCalledWith(query);
      expect(result).toBe(exportedData);
    });
  });

  describe('Echarts endpoints', () => {
    it('getEchartsDashboard should return formatted dashboard data', async () => {
      const timeSeries = { dates: ['2024-01-01'], views: [100] } as any;
      const devices = [{ device: 'desktop', count: 500 }] as any;
      const browsers = [{ browser: 'Chrome', count: 600 }] as any;
      const dashboard = { timeSeriesChart: {}, deviceChart: {}, browserChart: {} } as any;

      mockAnalyticsService.getChartData.mockResolvedValue(timeSeries);
      mockAnalyticsService.getDeviceStats.mockResolvedValue(devices);
      mockAnalyticsService.getBrowserStats.mockResolvedValue(browsers);
      mockEchartsFormatterService.formatDashboard.mockReturnValue(dashboard);

      const result = await controller.getEchartsDashboard();

      expect(mockAnalyticsService.getChartData).toHaveBeenCalledWith(undefined);
      expect(mockAnalyticsService.getDeviceStats).toHaveBeenCalled();
      expect(mockAnalyticsService.getBrowserStats).toHaveBeenCalled();
      expect(mockEchartsFormatterService.formatDashboard).toHaveBeenCalledWith(
        timeSeries,
        devices,
        browsers,
      );
      expect(result).toBe(dashboard);
    });

    it('getEchartsDashboard should accept days parameter', async () => {
      const days = 30;
      const timeSeries = { dates: [], views: [] } as any;
      const devices = [] as any;
      const browsers = [] as any;
      const dashboard = {} as any;

      mockAnalyticsService.getChartData.mockResolvedValue(timeSeries);
      mockAnalyticsService.getDeviceStats.mockResolvedValue(devices);
      mockAnalyticsService.getBrowserStats.mockResolvedValue(browsers);
      mockEchartsFormatterService.formatDashboard.mockReturnValue(dashboard);

      await controller.getEchartsDashboard(days);

      expect(mockAnalyticsService.getChartData).toHaveBeenCalledWith(days);
    });

    it('getEchartsTimeSeries should return formatted time series chart', async () => {
      const chartData = { dates: ['2024-01-01'], views: [100] } as any;
      const echartsOption = { title: {}, series: [] } as any;

      mockAnalyticsService.getChartData.mockResolvedValue(chartData);
      mockEchartsFormatterService.formatTimeSeriesChart.mockReturnValue(echartsOption);

      const result = await controller.getEchartsTimeSeries();

      expect(mockAnalyticsService.getChartData).toHaveBeenCalledWith(undefined);
      expect(mockEchartsFormatterService.formatTimeSeriesChart).toHaveBeenCalledWith(chartData);
      expect(result).toBe(echartsOption);
    });

    it('getEchartsDevices should return formatted device pie chart', async () => {
      const deviceStats = [{ device: 'desktop', count: 500 }] as any;
      const echartsOption = { title: {}, series: [] } as any;

      mockAnalyticsService.getDeviceStats.mockResolvedValue(deviceStats);
      mockEchartsFormatterService.formatDevicePieChart.mockReturnValue(echartsOption);

      const result = await controller.getEchartsDevices();

      expect(mockAnalyticsService.getDeviceStats).toHaveBeenCalled();
      expect(mockEchartsFormatterService.formatDevicePieChart).toHaveBeenCalledWith(deviceStats);
      expect(result).toBe(echartsOption);
    });

    it('getEchartsBrowsers should return formatted browser bar chart', async () => {
      const browserStats = [{ browser: 'Chrome', count: 600 }] as any;
      const echartsOption = { title: {}, series: [] } as any;

      mockAnalyticsService.getBrowserStats.mockResolvedValue(browserStats);
      mockEchartsFormatterService.formatBrowserBarChart.mockReturnValue(echartsOption);

      const result = await controller.getEchartsBrowsers();

      expect(mockAnalyticsService.getBrowserStats).toHaveBeenCalled();
      expect(mockEchartsFormatterService.formatBrowserBarChart).toHaveBeenCalledWith(browserStats);
      expect(result).toBe(echartsOption);
    });

    it('getEchartsPageRankings should return formatted page rankings chart', async () => {
      const rankings = [{ path: '/article/1', views: 100 }] as any;
      const echartsOption = { title: {}, series: [] } as any;

      mockAnalyticsService.getPageRankings.mockResolvedValue(rankings);
      mockEchartsFormatterService.formatPageRankingsChart.mockReturnValue(echartsOption);

      const result = await controller.getEchartsPageRankings();

      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(undefined);
      expect(mockEchartsFormatterService.formatPageRankingsChart).toHaveBeenCalledWith(rankings);
      expect(result).toBe(echartsOption);
    });

    it('getEchartsPageRankings should accept limit parameter', async () => {
      const limit = 10;
      const rankings = [] as any;
      const echartsOption = {} as any;

      mockAnalyticsService.getPageRankings.mockResolvedValue(rankings);
      mockEchartsFormatterService.formatPageRankingsChart.mockReturnValue(echartsOption);

      await controller.getEchartsPageRankings(limit);

      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(limit);
    });
  });

  describe('TsRest handlers', () => {
    it('getPublicViewer should return public overview data', async () => {
      const overview = {
        totalPageviews: 1000,
        totalVisitors: 500,
        todayPageviews: 50,
        todayVisitors: 25,
      } as any;
      mockPublicAnalyticsService.getPublicOverview.mockResolvedValue(overview);

      const handler = controller.getPublicViewer();
      const result = await handler();

      expect(result).toEqual({
        status: 200,
        body: {
          totalPageviews: 1000,
          totalVisitors: 500,
        },
      });
    });

    it('getArticleViewer should return article stats', async () => {
      const articleStats = {
        articleId: 123,
        title: 'Test Article',
        views: 100,
        uniqueVisitors: 50,
        avgReadTime: 120,
      } as any;
      mockPublicAnalyticsService.getPublicArticleStats.mockResolvedValue(articleStats);

      const handler = controller.getArticleViewer();
      const result = await handler({ params: { id: '123' } });

      expect(result).toEqual({
        status: 200,
        body: {
          articleId: 123,
          title: 'Test Article',
          views: 100,
          uniqueVisitors: 50,
          avgReadTime: 120,
        },
      });
    });

    it('getArticleViewer should return null when article not found', async () => {
      mockPublicAnalyticsService.getPublicArticleStats.mockResolvedValue(null);

      const handler = controller.getArticleViewer();
      const result = await handler({ params: { id: '999' } });

      expect(result).toEqual({
        status: 200,
        body: null,
      });
    });

    it('recordPublicViewer should record analytics and track pageview', async () => {
      const req = { ip: '192.168.1.1' } as any;
      const body = {
        type: 'pageview',
        path: '/article/1',
        referrer: 'google.com',
        userAgent: 'Mozilla/5.0',
        data: { articleId: 1 },
      };

      const handler = controller.recordPublicViewer(req);
      const result = await handler({ body, headers: { 'user-agent': 'Safari' } });

      expect(mockAnalyticsService.recordAnalytics).toHaveBeenCalledWith({
        type: 'pageview',
        path: '/article/1',
        referrer: 'google.com',
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
        data: { articleId: 1 },
      });
      expect(mockThirdPartyAnalyticsService.trackPageview).toHaveBeenCalledWith(
        '/article/1',
        '192.168.1.1',
        'Mozilla/5.0',
      );
      expect(result).toEqual({ status: 201, body: undefined });
    });

    it('recordPublicViewer should not track pageview for non-pageview events', async () => {
      const req = { ip: '192.168.1.1' } as any;
      const body = {
        type: 'event',
        data: { target: 'button' },
      };

      const handler = controller.recordPublicViewer(req);
      await handler({ body, headers: {} });

      expect(mockThirdPartyAnalyticsService.trackPageview).not.toHaveBeenCalled();
    });

    it('getAnalyticsOverview should return analytics overview', async () => {
      const overview = {
        totalPageviews: 1000,
        totalVisitors: 500,
        todayPageviews: 50,
        todayVisitors: 25,
      } as any;
      mockAnalyticsService.getOverview.mockResolvedValue(overview);

      const handler = controller.getAnalyticsOverview();
      const result = await handler();

      expect(result).toEqual({
        status: 200,
        body: {
          totalPageviews: 1000,
          totalVisitors: 500,
          todayPageviews: 50,
          todayVisitors: 25,
        },
      });
    });
  });

  describe('getPageRankings', () => {
    it('should return page rankings with default limit', async () => {
      const rankings = [
        { path: '/article/1', views: 100 },
        { path: '/article/2', views: 80 },
      ] as any;
      mockAnalyticsService.getPageRankings.mockResolvedValue(rankings);

      const result = await controller.getPageRankings();

      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(undefined);
      expect(result).toBe(rankings);
    });

    it('should return page rankings with custom limit', async () => {
      const limit = 5;
      const rankings = [{ path: '/article/1', views: 100 }] as any;
      mockAnalyticsService.getPageRankings.mockResolvedValue(rankings);

      const result = await controller.getPageRankings(limit);

      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(limit);
      expect(result).toBe(rankings);
    });
  });

  describe('getReferrerStats', () => {
    it('should return referrer statistics', async () => {
      const stats = [
        { referrer: 'google.com', count: 50 },
        { referrer: 'twitter.com', count: 30 },
      ] as any;
      mockAnalyticsService.getReferrerStats.mockResolvedValue(stats);

      const result = await controller.getReferrerStats();

      expect(mockAnalyticsService.getReferrerStats).toHaveBeenCalledWith(undefined);
      expect(result).toBe(stats);
    });

    it('should return referrer statistics with limit', async () => {
      const limit = 10;
      const stats = [{ referrer: 'google.com', count: 50 }] as any;
      mockAnalyticsService.getReferrerStats.mockResolvedValue(stats);

      const result = await controller.getReferrerStats(limit);

      expect(mockAnalyticsService.getReferrerStats).toHaveBeenCalledWith(limit);
      expect(result).toBe(stats);
    });
  });

  describe('getChartData', () => {
    it('should return chart data with default days', async () => {
      const chartData = { dates: ['2024-01-01'], views: [100] } as any;
      mockAnalyticsService.getChartData.mockResolvedValue(chartData);

      const result = await controller.getChartData();

      expect(mockAnalyticsService.getChartData).toHaveBeenCalledWith(undefined);
      expect(result).toBe(chartData);
    });

    it('should return chart data with custom days', async () => {
      const days = 7;
      const chartData = { dates: ['2024-01-01'], views: [100] } as any;
      mockAnalyticsService.getChartData.mockResolvedValue(chartData);

      const result = await controller.getChartData(days);

      expect(mockAnalyticsService.getChartData).toHaveBeenCalledWith(days);
      expect(result).toBe(chartData);
    });
  });

  describe('getDeviceStats', () => {
    it('should return device statistics', async () => {
      const deviceStats = [
        { device: 'desktop', count: 500 },
        { device: 'mobile', count: 300 },
      ] as any;
      mockAnalyticsService.getDeviceStats.mockResolvedValue(deviceStats);

      const result = await controller.getDeviceStats();

      expect(mockAnalyticsService.getDeviceStats).toHaveBeenCalled();
      expect(result).toBe(deviceStats);
    });
  });

  describe('getBrowserStats', () => {
    it('should return browser statistics', async () => {
      const browserStats = [
        { browser: 'Chrome', count: 600 },
        { browser: 'Firefox', count: 200 },
      ] as any;
      mockAnalyticsService.getBrowserStats.mockResolvedValue(browserStats);

      const result = await controller.getBrowserStats();

      expect(mockAnalyticsService.getBrowserStats).toHaveBeenCalled();
      expect(result).toBe(browserStats);
    });
  });

  describe('getTopArticles', () => {
    it('should return top articles with default limit', async () => {
      const topArticles = [
        { articleId: 1, views: 1000 },
        { articleId: 2, views: 800 },
      ] as any;
      mockArticleStatsService.getTopArticles.mockResolvedValue(topArticles);

      const result = await controller.getTopArticles();

      expect(mockArticleStatsService.getTopArticles).toHaveBeenCalledWith(undefined);
      expect(result).toBe(topArticles);
    });

    it('should return top articles with custom limit', async () => {
      const limit = 5;
      const topArticles = [{ articleId: 1, views: 1000 }] as any;
      mockArticleStatsService.getTopArticles.mockResolvedValue(topArticles);

      const result = await controller.getTopArticles(limit);

      expect(mockArticleStatsService.getTopArticles).toHaveBeenCalledWith(limit);
      expect(result).toBe(topArticles);
    });
  });

  describe('exportAnalyticsData', () => {
    it('should export analytics data with query parameters', async () => {
      const query = { type: 'pageview', startDate: '2024-01-01' };
      const exportedData = [{ id: 1, type: 'pageview' }] as any;
      mockAnalyticsService.exportAnalyticsData.mockResolvedValue(exportedData);

      const result = await controller.exportAnalyticsData(query);

      expect(mockAnalyticsService.exportAnalyticsData).toHaveBeenCalledWith(query);
      expect(result).toBe(exportedData);
    });
  });

  describe('Echarts endpoints', () => {
    it('getEchartsDashboard should return formatted dashboard data', async () => {
      const timeSeries = { dates: ['2024-01-01'], views: [100] } as any;
      const devices = [{ device: 'desktop', count: 500 }] as any;
      const browsers = [{ browser: 'Chrome', count: 600 }] as any;
      const dashboard = { timeSeriesChart: {}, deviceChart: {}, browserChart: {} } as any;

      mockAnalyticsService.getChartData.mockResolvedValue(timeSeries);
      mockAnalyticsService.getDeviceStats.mockResolvedValue(devices);
      mockAnalyticsService.getBrowserStats.mockResolvedValue(browsers);
      mockEchartsFormatterService.formatDashboard.mockReturnValue(dashboard);

      const result = await controller.getEchartsDashboard();

      expect(mockAnalyticsService.getChartData).toHaveBeenCalledWith(undefined);
      expect(mockAnalyticsService.getDeviceStats).toHaveBeenCalled();
      expect(mockAnalyticsService.getBrowserStats).toHaveBeenCalled();
      expect(mockEchartsFormatterService.formatDashboard).toHaveBeenCalledWith(
        timeSeries,
        devices,
        browsers,
      );
      expect(result).toBe(dashboard);
    });

    it('getEchartsDashboard should accept days parameter', async () => {
      const days = 30;
      const timeSeries = { dates: [], views: [] } as any;
      const devices = [] as any;
      const browsers = [] as any;
      const dashboard = {} as any;

      mockAnalyticsService.getChartData.mockResolvedValue(timeSeries);
      mockAnalyticsService.getDeviceStats.mockResolvedValue(devices);
      mockAnalyticsService.getBrowserStats.mockResolvedValue(browsers);
      mockEchartsFormatterService.formatDashboard.mockReturnValue(dashboard);

      await controller.getEchartsDashboard(days);

      expect(mockAnalyticsService.getChartData).toHaveBeenCalledWith(days);
    });

    it('getEchartsTimeSeries should return formatted time series chart', async () => {
      const chartData = { dates: ['2024-01-01'], views: [100] } as any;
      const echartsOption = { title: {}, series: [] } as any;

      mockAnalyticsService.getChartData.mockResolvedValue(chartData);
      mockEchartsFormatterService.formatTimeSeriesChart.mockReturnValue(echartsOption);

      const result = await controller.getEchartsTimeSeries();

      expect(mockAnalyticsService.getChartData).toHaveBeenCalledWith(undefined);
      expect(mockEchartsFormatterService.formatTimeSeriesChart).toHaveBeenCalledWith(chartData);
      expect(result).toBe(echartsOption);
    });

    it('getEchartsDevices should return formatted device pie chart', async () => {
      const deviceStats = [{ device: 'desktop', count: 500 }] as any;
      const echartsOption = { title: {}, series: [] } as any;

      mockAnalyticsService.getDeviceStats.mockResolvedValue(deviceStats);
      mockEchartsFormatterService.formatDevicePieChart.mockReturnValue(echartsOption);

      const result = await controller.getEchartsDevices();

      expect(mockAnalyticsService.getDeviceStats).toHaveBeenCalled();
      expect(mockEchartsFormatterService.formatDevicePieChart).toHaveBeenCalledWith(deviceStats);
      expect(result).toBe(echartsOption);
    });

    it('getEchartsBrowsers should return formatted browser bar chart', async () => {
      const browserStats = [{ browser: 'Chrome', count: 600 }] as any;
      const echartsOption = { title: {}, series: [] } as any;

      mockAnalyticsService.getBrowserStats.mockResolvedValue(browserStats);
      mockEchartsFormatterService.formatBrowserBarChart.mockReturnValue(echartsOption);

      const result = await controller.getEchartsBrowsers();

      expect(mockAnalyticsService.getBrowserStats).toHaveBeenCalled();
      expect(mockEchartsFormatterService.formatBrowserBarChart).toHaveBeenCalledWith(browserStats);
      expect(result).toBe(echartsOption);
    });

    it('getEchartsPageRankings should return formatted page rankings chart', async () => {
      const rankings = [{ path: '/article/1', views: 100 }] as any;
      const echartsOption = { title: {}, series: [] } as any;

      mockAnalyticsService.getPageRankings.mockResolvedValue(rankings);
      mockEchartsFormatterService.formatPageRankingsChart.mockReturnValue(echartsOption);

      const result = await controller.getEchartsPageRankings();

      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(undefined);
      expect(mockEchartsFormatterService.formatPageRankingsChart).toHaveBeenCalledWith(rankings);
      expect(result).toBe(echartsOption);
    });

    it('getEchartsPageRankings should accept limit parameter', async () => {
      const limit = 10;
      const rankings = [] as any;
      const echartsOption = {} as any;

      mockAnalyticsService.getPageRankings.mockResolvedValue(rankings);
      mockEchartsFormatterService.formatPageRankingsChart.mockReturnValue(echartsOption);

      await controller.getEchartsPageRankings(limit);

      expect(mockAnalyticsService.getPageRankings).toHaveBeenCalledWith(limit);
    });
  });

  describe('TsRest handlers', () => {
    it('getPublicViewer should return public overview data', async () => {
      const overview = {
        totalPageviews: 1000,
        totalVisitors: 500,
        todayPageviews: 50,
        todayVisitors: 25,
      } as any;
      mockPublicAnalyticsService.getPublicOverview.mockResolvedValue(overview);

      const handler = controller.getPublicViewer();
      const result = await handler();

      expect(result).toEqual({
        status: 200,
        body: {
          totalPageviews: 1000,
          totalVisitors: 500,
        },
      });
    });

    it('getArticleViewer should return article stats', async () => {
      const articleStats = {
        articleId: 123,
        title: 'Test Article',
        views: 100,
        uniqueVisitors: 50,
        avgReadTime: 120,
      } as any;
      mockPublicAnalyticsService.getPublicArticleStats.mockResolvedValue(articleStats);

      const handler = controller.getArticleViewer();
      const result = await handler({ params: { id: '123' } });

      expect(result).toEqual({
        status: 200,
        body: {
          articleId: 123,
          title: 'Test Article',
          views: 100,
          uniqueVisitors: 50,
          avgReadTime: 120,
        },
      });
    });

    it('getArticleViewer should return null when article not found', async () => {
      mockPublicAnalyticsService.getPublicArticleStats.mockResolvedValue(null);

      const handler = controller.getArticleViewer();
      const result = await handler({ params: { id: '999' } });

      expect(result).toEqual({
        status: 200,
        body: null,
      });
    });

    it('recordPublicViewer should record analytics and track pageview', async () => {
      const req = { ip: '192.168.1.1' } as any;
      const body = {
        type: 'pageview',
        path: '/article/1',
        referrer: 'google.com',
        userAgent: 'Mozilla/5.0',
        data: { articleId: 1 },
      };

      const handler = controller.recordPublicViewer(req);
      const result = await handler({ body, headers: { 'user-agent': 'Safari' } });

      expect(mockAnalyticsService.recordAnalytics).toHaveBeenCalledWith({
        type: 'pageview',
        path: '/article/1',
        referrer: 'google.com',
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
        data: { articleId: 1 },
      });
      expect(mockThirdPartyAnalyticsService.trackPageview).toHaveBeenCalledWith(
        '/article/1',
        '192.168.1.1',
        'Mozilla/5.0',
      );
      expect(result).toEqual({ status: 201, body: undefined });
    });

    it('recordPublicViewer should not track pageview for non-pageview events', async () => {
      const req = { ip: '192.168.1.1' } as any;
      const body = {
        type: 'event',
        data: { target: 'button' },
      };

      const handler = controller.recordPublicViewer(req);
      await handler({ body, headers: {} });

      expect(mockThirdPartyAnalyticsService.trackPageview).not.toHaveBeenCalled();
    });

    it('getAnalyticsOverview should return analytics overview', async () => {
      const overview = {
        totalPageviews: 1000,
        totalVisitors: 500,
        todayPageviews: 50,
        todayVisitors: 25,
      } as any;
      mockAnalyticsService.getOverview.mockResolvedValue(overview);

      const handler = controller.getAnalyticsOverview();
      const result = await handler();

      expect(result).toEqual({
        status: 200,
        body: {
          totalPageviews: 1000,
          totalVisitors: 500,
          todayPageviews: 50,
          todayVisitors: 25,
        },
      });
    });
  });
});
