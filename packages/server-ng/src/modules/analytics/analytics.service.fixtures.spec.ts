import { describe, expect } from 'vitest';

import { test } from '../../../test/vitest-fixtures.test';

import { AnalyticsType } from './entities/analytics.entity';
import { AnalyticsService } from './services/analytics.service';

import type { RecordAnalyticsDto } from './dto/record-analytics.dto';

// 扩展测试上下文，添加 AnalyticsService 实例
const analyticsTest = test.extend<{ analyticsService: AnalyticsService }>({
  analyticsService: async ({ db }, use) => {
    const service = new AnalyticsService(db);
    await use(service);
  },
});

describe('AnalyticsService with Vitest Fixtures', () => {
  describe('recordAnalytics', () => {
    analyticsTest('should record analytics data', async ({ analyticsService, databaseMock }) => {
      const dto = {
        type: AnalyticsType.PAGEVIEW,
        path: '/blog/test',
        referrer: 'https://google.com',
        userAgent: 'Mozilla/5.0',
        ip: '127.0.0.1',
      } as unknown as RecordAnalyticsDto;

      await analyticsService.recordAnalytics(dto);

      expect(databaseMock.db.insert).toHaveBeenCalled();
      expect(databaseMock.db.values).toHaveBeenCalledWith({
        type: dto.type,
        path: dto.path,
        referrer: dto.referrer,
        userAgent: dto.userAgent,
        ip: dto.ip,
        data: null,
      });
    });

    analyticsTest(
      'should record analytics data with metadata',
      async ({ analyticsService, databaseMock }) => {
        const testData = { action: 'click', label: 'button' };
        const dto = {
          type: AnalyticsType.EVENT,
          path: '/blog/test',
          referrer: 'https://google.com',
          userAgent: 'Mozilla/5.0',
          ip: '127.0.0.1',
          data: testData,
        } as unknown as RecordAnalyticsDto;

        await analyticsService.recordAnalytics(dto);

        expect(databaseMock.db.values).toHaveBeenCalledWith({
          type: dto.type,
          path: dto.path,
          referrer: dto.referrer,
          userAgent: dto.userAgent,
          ip: dto.ip,
          data: JSON.stringify(testData),
        });
      },
    );
  });

  describe('getOverview', () => {
    analyticsTest(
      'should return analytics overview',
      async ({ analyticsService, databaseMock }) => {
        databaseMock.setQueryResult([{ count: 100 }]);

        const overview = await analyticsService.getOverview();

        expect(overview).toHaveProperty('todayPageviews');
        expect(overview).toHaveProperty('yesterdayPageviews');
        expect(overview).toHaveProperty('totalPageviews');
        expect(overview).toHaveProperty('todayVisitors');
        expect(overview).toHaveProperty('yesterdayVisitors');
        expect(overview).toHaveProperty('totalVisitors');
      },
    );
  });

  describe('getPageRankings', () => {
    analyticsTest('should return page rankings', async ({ analyticsService, databaseMock }) => {
      const mockResult = [
        { path: '/blog/article1', views: 100, uniqueVisitors: 50 },
        { path: '/blog/article2', views: 80, uniqueVisitors: 40 },
      ];

      databaseMock.setQueryResult(mockResult);

      const rankings = await analyticsService.getPageRankings();

      expect(rankings).toHaveLength(2);
      expect(rankings[0]).toEqual({
        path: '/blog/article1',
        views: 100,
        uniqueVisitors: 50,
      });
    });
  });

  describe('getDeviceStats', () => {
    analyticsTest('should return device statistics', async ({ analyticsService, databaseMock }) => {
      const mockResult = [
        { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', count: 50 },
        { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', count: 30 },
        { userAgent: 'Mozilla/5.0 (Linux; Android 10)', count: 20 },
      ];

      databaseMock.setQueryResult(mockResult);

      const stats = await analyticsService.getDeviceStats();

      expect(stats).toBeDefined();
      expect(stats.length).toBeGreaterThan(0);
      expect(stats[0]).toHaveProperty('device');
      expect(stats[0]).toHaveProperty('count');
      expect(stats[0]).toHaveProperty('percentage');
    });
  });

  describe('getChartData', () => {
    analyticsTest(
      'should return chart data for specified days',
      async ({ analyticsService, databaseMock }) => {
        databaseMock.setQueryResult([{ count: 10 }]);

        const chartData = await analyticsService.getChartData(7);

        expect(chartData).toHaveProperty('pageviews');
        expect(chartData).toHaveProperty('visitors');
        expect(chartData.pageviews).toHaveLength(7);
        expect(chartData.visitors).toHaveLength(7);
        expect(chartData.pageviews[0]).toHaveProperty('time');
        expect(chartData.pageviews[0]).toHaveProperty('value');
      },
    );
  });
});
