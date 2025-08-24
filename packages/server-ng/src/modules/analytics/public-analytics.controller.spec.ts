import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { PublicAnalyticsController } from './public-analytics.controller';
import { PublicAnalyticsService } from './services/public-analytics.service';

const mockPublicAnalyticsService = {
  getPublicOverview: vi.fn(),
  getPublicArticleStats: vi.fn(),
  getPublicPageRankings: vi.fn(),
};

describe('PublicAnalyticsController', () => {
  let controller: PublicAnalyticsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicAnalyticsController],
      providers: [{ provide: PublicAnalyticsService, useValue: mockPublicAnalyticsService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PublicAnalyticsController>(PublicAnalyticsController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getPublicOverview should delegate to service and return value', async () => {
    const overview = {
      todayPv: 1,
      todayUv: 1,
      yesterdayPv: 2,
      yesterdayUv: 2,
      totalPv: 3,
      totalUv: 3,
    } as any;
    mockPublicAnalyticsService.getPublicOverview.mockResolvedValue(overview);

    const result = await controller.getPublicOverview();

    expect(mockPublicAnalyticsService.getPublicOverview).toHaveBeenCalled();
    expect(result).toBe(overview);
  });

  it('getPublicArticleStats should pass id and return value', async () => {
    const id = 123;
    const stats = { pv: 10, uv: 5, avgReadTime: 30 } as any;
    mockPublicAnalyticsService.getPublicArticleStats.mockResolvedValue(stats);

    const result = await controller.getPublicArticleStats(id);

    expect(mockPublicAnalyticsService.getPublicArticleStats).toHaveBeenCalledWith(id);
    expect(result).toBe(stats);
  });

  it('getPublicPageRankings should request top 10 and return list', async () => {
    const list = [{ path: '/a', pv: 10 }];
    mockPublicAnalyticsService.getPublicPageRankings.mockResolvedValue(list as any);

    const result = await controller.getPublicPageRankings();

    expect(mockPublicAnalyticsService.getPublicPageRankings).toHaveBeenCalledWith(10);
    expect(result).toBe(list);
  });
});
