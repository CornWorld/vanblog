import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../database/database.module';

import { AnalyticsType } from './entities/analytics.entity';
import { AnalyticsService } from './services/analytics.service';

import type { RecordAnalyticsDto } from './dto/record-analytics.dto';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockDb: {
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('recordAnalytics', () => {
    it('should record analytics data', async () => {
      const dto = {
        type: AnalyticsType.PAGEVIEW,
        path: '/blog/test',
        referrer: 'https://google.com',
        userAgent: 'Mozilla/5.0',
        ip: '127.0.0.1',
      } as unknown as RecordAnalyticsDto;

      await service.recordAnalytics(dto);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        type: dto.type,
        path: dto.path,
        referrer: dto.referrer,
        userAgent: dto.userAgent,
        ip: dto.ip,
        data: null,
      });
    });

    it('should record analytics data with metadata', async () => {
      const testData = { action: 'click', label: 'button' };
      const dto = {
        type: AnalyticsType.EVENT,
        path: '/blog/test',
        referrer: 'https://google.com',
        userAgent: 'Mozilla/5.0',
        ip: '127.0.0.1',
        data: testData,
      } as unknown as RecordAnalyticsDto;

      await service.recordAnalytics(dto);

      expect(mockDb.values).toHaveBeenCalledWith({
        type: dto.type,
        path: dto.path,
        referrer: dto.referrer,
        userAgent: dto.userAgent,
        ip: dto.ip,
        data: JSON.stringify(testData),
      });
    });
  });

  describe('getOverview', () => {
    it('should return analytics overview', async () => {
      mockDb.execute = vi.fn().mockResolvedValue([{ count: 100 }]);

      const overview = await service.getOverview();

      expect(overview).toHaveProperty('todayPageviews');
      expect(overview).toHaveProperty('yesterdayPageviews');
      expect(overview).toHaveProperty('totalPageviews');
      expect(overview).toHaveProperty('todayVisitors');
      expect(overview).toHaveProperty('yesterdayVisitors');
      expect(overview).toHaveProperty('totalVisitors');
    });
  });

  describe('getPageRankings', () => {
    it('should return page rankings', async () => {
      const mockResult = [
        { path: '/blog/article1', views: 100, uniqueVisitors: 50 },
        { path: '/blog/article2', views: 80, uniqueVisitors: 40 },
      ];

      mockDb.limit = vi.fn().mockResolvedValue(mockResult);

      const rankings = await service.getPageRankings();

      expect(rankings).toHaveLength(2);
      expect(rankings[0]).toEqual({
        path: '/blog/article1',
        views: 100,
        uniqueVisitors: 50,
      });
    });
  });

  describe('getDeviceStats', () => {
    it('should return device statistics', async () => {
      const mockResult = [
        { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', count: 50 },
        { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', count: 30 },
        { userAgent: 'Mozilla/5.0 (Linux; Android 10)', count: 20 },
      ];

      mockDb.groupBy = vi.fn().mockResolvedValue(mockResult);

      const stats = await service.getDeviceStats();

      expect(stats).toBeDefined();
      expect(stats.length).toBeGreaterThan(0);
      expect(stats[0]).toHaveProperty('device');
      expect(stats[0]).toHaveProperty('count');
      expect(stats[0]).toHaveProperty('percentage');
    });
  });

  describe('getChartData', () => {
    it('should return chart data for specified days', async () => {
      mockDb.execute = vi.fn().mockResolvedValue([{ count: 10 }]);

      const chartData = await service.getChartData(7);

      expect(chartData).toHaveProperty('pageviews');
      expect(chartData).toHaveProperty('visitors');
      expect(chartData.pageviews).toHaveLength(7);
      expect(chartData.visitors).toHaveLength(7);
      expect(chartData.pageviews[0]).toHaveProperty('time');
      expect(chartData.pageviews[0]).toHaveProperty('value');
    });
  });
});
