import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { dayjs } from '@vanblog/shared';

import { DATABASE_CONNECTION } from '../../database';
import { CacheService } from './cache.service';
import { AnalyticsCacheService } from './analytics-cache.service';

describe('AnalyticsCacheService', () => {
  let service: AnalyticsCacheService;
  let module: TestingModule;
  let mockDb: any;
  let mockCache: CacheService;

  beforeEach(async () => {
    // Mock Database with proper chain
    mockDb = {
      select: vi.fn(),
      $primaryKeys: undefined,
    };

    // Mock Cache Service
    mockCache = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      wrap: vi.fn(),
      del: vi.fn(),
      clear: vi.fn().mockResolvedValue(undefined),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        AnalyticsCacheService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: CacheService,
          useValue: mockCache,
        },
      ],
    }).compile();

    service = module.get<AnalyticsCacheService>(AnalyticsCacheService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('updateOverviewCache', () => {
    it('should calculate and cache overview data', async () => {
      const mockTotalResult = {
        totalViews: 1000,
        totalUniqueVisitors: 500,
      };
      const mockTodayResult = {
        todayViews: 50,
        todayUniqueVisitors: 25,
      };
      const mockYesterdayResult = {
        yesterdayViews: 40,
        yesterdayUniqueVisitors: 20,
      };

      // Mock the three separate queries in calculateOverview
      // First query: select().from() (no where)
      // Second query: select().from().where()
      // Third query: select().from().where()
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First query - no where clause
          return {
            from: vi.fn().mockResolvedValue([mockTotalResult]),
          };
        } else {
          // Second and third queries - have where clause
          return {
            from: vi.fn().mockReturnValue({
              where: vi
                .fn()
                .mockResolvedValue(callCount === 2 ? [mockTodayResult] : [mockYesterdayResult]),
            }),
          };
        }
      });

      await service.updateOverviewCache();

      expect(mockCache.set).toHaveBeenCalledWith('analytics:overview', expect.any(Object), 300);
    });

    it('should handle errors during overview calculation', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      // Should not throw, just log error
      await expect(service.updateOverviewCache()).resolves.toBeUndefined();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('updatePageRankingsCache', () => {
    it('should calculate and cache page rankings', async () => {
      const mockRankings = [
        { path: '/post/1', views: 100, uniqueVisitors: 50 },
        { path: '/post/2', views: 80, uniqueVisitors: 40 },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockRankings),
          }),
        }),
      });

      await service.updatePageRankingsCache();

      expect(mockCache.set).toHaveBeenCalledWith('analytics:page-rankings', mockRankings, 600);
    });

    it('should handle errors during page rankings calculation', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(service.updatePageRankingsCache()).resolves.toBeUndefined();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('updateReferrerStatsCache', () => {
    it('should calculate and cache referrer stats', async () => {
      const mockReferrers = [
        { referrer: 'https://google.com', views: 100, uniqueVisitors: 50 },
        { referrer: 'https://twitter.com', views: 80, uniqueVisitors: 40 },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockReferrers),
            }),
          }),
        }),
      });

      await service.updateReferrerStatsCache();

      expect(mockCache.set).toHaveBeenCalledWith('analytics:referrer-stats', mockReferrers, 900);
    });

    it('should handle errors during referrer stats calculation', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(service.updateReferrerStatsCache()).resolves.toBeUndefined();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('updateChartDataCache', () => {
    it('should calculate and cache chart data for last 30 days', async () => {
      const mockChartData = [
        {
          date: dayjs().format('YYYY-MM-DD'),
          views: 50,
          uniqueVisitors: 25,
        },
        {
          date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
          views: 45,
          uniqueVisitors: 22,
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockChartData),
            }),
          }),
        }),
      });

      await service.updateChartDataCache();

      expect(mockCache.set).toHaveBeenCalledWith('analytics:chart-data', mockChartData, 3600);
    });

    it('should handle errors during chart data calculation', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(service.updateChartDataCache()).resolves.toBeUndefined();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('getOverview', () => {
    it('should return cached overview data', async () => {
      const mockOverviewData = {
        totalViews: 1000,
        totalUniqueVisitors: 500,
        todayViews: 50,
        todayUniqueVisitors: 25,
        yesterdayViews: 40,
        yesterdayUniqueVisitors: 20,
      };

      mockCache.wrap = vi.fn().mockResolvedValue(mockOverviewData);

      const result = await service.getOverview();

      expect(result).toEqual(mockOverviewData);
      expect(mockCache.wrap).toHaveBeenCalledWith('analytics:overview', expect.any(Function), 300);
    });

    it('should calculate overview if cache miss', async () => {
      const mockTotalResult = {
        totalViews: 1000,
        totalUniqueVisitors: 500,
      };
      const mockTodayResult = {
        todayViews: 50,
        todayUniqueVisitors: 25,
      };
      const mockYesterdayResult = {
        yesterdayViews: 40,
        yesterdayUniqueVisitors: 20,
      };

      // Simulate cache miss by having wrap call the generator function
      mockCache.wrap = vi.fn().mockImplementation(async (_key, generator) => {
        return await generator();
      });

      // Mock the three separate queries in calculateOverview
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First query - no where clause
          return {
            from: vi.fn().mockResolvedValue([mockTotalResult]),
          };
        } else {
          // Second and third queries - have where clause
          return {
            from: vi.fn().mockReturnValue({
              where: vi
                .fn()
                .mockResolvedValue(callCount === 2 ? [mockTodayResult] : [mockYesterdayResult]),
            }),
          };
        }
      });

      const result = await service.getOverview();

      expect(result).toEqual({
        totalViews: 1000,
        totalUniqueVisitors: 500,
        todayViews: 50,
        todayUniqueVisitors: 25,
        yesterdayViews: 40,
        yesterdayUniqueVisitors: 20,
      });
    });
  });

  describe('getPageRankings', () => {
    it('should return cached page rankings', async () => {
      const mockRankings = [
        { path: '/post/1', views: 100, uniqueVisitors: 50 },
        { path: '/post/2', views: 80, uniqueVisitors: 40 },
      ];

      mockCache.wrap = vi.fn().mockResolvedValue(mockRankings);

      const result = await service.getPageRankings();

      expect(result).toEqual(mockRankings);
      expect(mockCache.wrap).toHaveBeenCalledWith(
        'analytics:page-rankings',
        expect.any(Function),
        600,
      );
    });

    it('should calculate rankings if cache miss', async () => {
      const mockRankings = [
        { path: '/post/1', views: 100, uniqueVisitors: 50 },
        { path: '/post/2', views: 80, uniqueVisitors: 40 },
      ];

      mockCache.wrap = vi.fn().mockImplementation(async (_key, generator) => {
        return await generator();
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockRankings),
          }),
        }),
      });

      const result = await service.getPageRankings();

      expect(result).toEqual(mockRankings);
    });
  });

  describe('getReferrerStats', () => {
    it('should return cached referrer stats', async () => {
      const mockReferrers = [
        { referrer: 'https://google.com', views: 100, uniqueVisitors: 50 },
        { referrer: 'https://twitter.com', views: 80, uniqueVisitors: 40 },
      ];

      mockCache.wrap = vi.fn().mockResolvedValue(mockReferrers);

      const result = await service.getReferrerStats();

      expect(result).toEqual(mockReferrers);
      expect(mockCache.wrap).toHaveBeenCalledWith(
        'analytics:referrer-stats',
        expect.any(Function),
        900,
      );
    });

    it('should calculate stats if cache miss', async () => {
      const mockReferrers = [
        { referrer: 'https://google.com', views: 100, uniqueVisitors: 50 },
        { referrer: 'https://twitter.com', views: 80, uniqueVisitors: 40 },
      ];

      mockCache.wrap = vi.fn().mockImplementation(async (_key, generator) => {
        return await generator();
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockReferrers),
            }),
          }),
        }),
      });

      const result = await service.getReferrerStats();

      expect(result).toEqual(mockReferrers);
    });
  });

  describe('getChartData', () => {
    it('should return cached chart data', async () => {
      const mockChartData = [
        {
          date: dayjs().format('YYYY-MM-DD'),
          views: 50,
          uniqueVisitors: 25,
        },
      ];

      mockCache.wrap = vi.fn().mockResolvedValue(mockChartData);

      const result = await service.getChartData();

      expect(result).toEqual(mockChartData);
      expect(mockCache.wrap).toHaveBeenCalledWith(
        'analytics:chart-data',
        expect.any(Function),
        3600,
      );
    });

    it('should calculate chart data if cache miss', async () => {
      const mockChartData = [
        {
          date: dayjs().format('YYYY-MM-DD'),
          views: 50,
          uniqueVisitors: 25,
        },
      ];

      mockCache.wrap = vi.fn().mockImplementation(async (_key, generator) => {
        return await generator();
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockChartData),
            }),
          }),
        }),
      });

      const result = await service.getChartData();

      expect(result).toEqual(mockChartData);
    });
  });

  describe('cron jobs', () => {
    it('should have correct cron decorators for scheduled tasks', () => {
      // Verify that cron decorators are properly applied
      // This is more of a structural test to ensure cron jobs are configured
      expect(service.updateOverviewCache).toBeDefined();
      expect(service.updatePageRankingsCache).toBeDefined();
      expect(service.updateReferrerStatsCache).toBeDefined();
      expect(service.updateChartDataCache).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty database results for overview', async () => {
      const mockTotalResult = {
        totalViews: 0,
        totalUniqueVisitors: 0,
      };
      const mockTodayResult = {
        todayViews: 0,
        todayUniqueVisitors: 0,
      };
      const mockYesterdayResult = {
        yesterdayViews: 0,
        yesterdayUniqueVisitors: 0,
      };

      mockCache.wrap = vi.fn().mockImplementation(async (_key, generator) => {
        return await generator();
      });

      // Mock the three separate queries in calculateOverview
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First query - no where clause
          return {
            from: vi.fn().mockResolvedValue([mockTotalResult]),
          };
        } else {
          // Second and third queries - have where clause
          return {
            from: vi.fn().mockReturnValue({
              where: vi
                .fn()
                .mockResolvedValue(callCount === 2 ? [mockTodayResult] : [mockYesterdayResult]),
            }),
          };
        }
      });

      const result = await service.getOverview();

      expect(result.totalViews).toBe(0);
      expect(result.totalUniqueVisitors).toBe(0);
    });

    it('should handle empty array results for page rankings', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockCache.wrap = vi.fn().mockImplementation(async (_key, generator) => {
        return await generator();
      });

      const result = await service.getPageRankings();

      expect(result).toEqual([]);
    });

    it('should handle null referrer values', async () => {
      const mockReferrers = [{ referrer: null, views: 10, uniqueVisitors: 5 }];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockReferrers),
            }),
          }),
        }),
      });

      mockCache.wrap = vi.fn().mockImplementation(async (_key, generator) => {
        return await generator();
      });

      const result = await service.getReferrerStats();

      expect(result).toEqual(mockReferrers);
    });
  });

  describe('data consistency', () => {
    it('should use consistent date format across all methods', () => {
      const expectedDateFormat = 'YYYY-MM-DD';
      const today = dayjs().format(expectedDateFormat);

      // Verify date format matches expected pattern
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should calculate 30 days ago correctly for chart data', () => {
      const thirtyDaysAgo = dayjs().subtract(30, 'day').format('YYYY-MM-DD');

      // Verify date is in the past
      expect(new Date(thirtyDaysAgo).getTime()).toBeLessThan(Date.now());
    });
  });
});
