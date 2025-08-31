import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsType } from './entities/analytics.entity';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService } from './services/article-stats.service';
import { EchartsFormatterService } from './services/echarts-formatter.service';
import { ThirdPartyAnalyticsService } from './services/third-party-analytics.service';

// Mocks
const mockAnalyticsService = {
  recordAnalytics: vi.fn(),
  getOverview: vi.fn(),
  getReferrerStats: vi.fn(),
  getDeviceStats: vi.fn(),
  getBrowserStats: vi.fn(),
  exportAnalytics: vi.fn(),
};

const mockArticleStatsService = {
  getArticleStats: vi.fn(),
};

const mockThirdPartyAnalyticsService = {
  trackPageview: vi.fn(),
};

const mockEchartsFormatterService = {
  formatTimeSeriesData: vi.fn(),
};

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: ArticleStatsService, useValue: mockArticleStatsService },
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
      const dto = { type: AnalyticsType.PAGEVIEW, path: '/home' } as any;

      await controller.recordAnalytics(dto);

      expect(mockAnalyticsService.recordAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ type: AnalyticsType.PAGEVIEW, path: '/home' }),
      );
      expect(mockThirdPartyAnalyticsService.trackPageview).toHaveBeenCalledWith(
        '/home',
        undefined,
        undefined,
      );
    });

    it('should persist non-pageview event via analytics service only', async () => {
      const dto = { type: AnalyticsType.EVENT, data: { target: 'btn' } } as any;

      await controller.recordAnalytics(dto);

      expect(mockAnalyticsService.recordAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ type: AnalyticsType.EVENT, data: { target: 'btn' } }),
      );
      expect(mockThirdPartyAnalyticsService.trackPageview).not.toHaveBeenCalled();
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
});
