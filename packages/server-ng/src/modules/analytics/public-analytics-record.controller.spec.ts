import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { PublicAnalyticsRecordController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService } from './services/article-stats.service';
import { ThirdPartyAnalyticsService } from './services/third-party-analytics.service';
import { AnalyticsCacheService } from '../../shared/cache/analytics-cache.service';
import { DerivedViewCacheService } from '../../shared/cache/derived-view-cache.service';

describe('PublicAnalyticsRecordController', () => {
  let controller: PublicAnalyticsRecordController;
  let analyticsService: { recordAnalytics: ReturnType<typeof vi.fn> };
  let articleStatsService: {
    recordArticleView: ReturnType<typeof vi.fn>;
    recordReadingTime: ReturnType<typeof vi.fn>;
  };
  let thirdPartyAnalyticsService: { trackPageview: ReturnType<typeof vi.fn> };
  let analyticsCacheService: { clear: ReturnType<typeof vi.fn> };
  let derivedViewCacheService: { clear: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    analyticsService = { recordAnalytics: vi.fn() };
    articleStatsService = {
      recordArticleView: vi.fn(),
      recordReadingTime: vi.fn(),
    };
    thirdPartyAnalyticsService = { trackPageview: vi.fn() };
    analyticsCacheService = { clear: vi.fn() };
    derivedViewCacheService = { clear: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicAnalyticsRecordController],
      providers: [
        { provide: AnalyticsService, useValue: analyticsService },
        { provide: ArticleStatsService, useValue: articleStatsService },
        { provide: ThirdPartyAnalyticsService, useValue: thirdPartyAnalyticsService },
        { provide: AnalyticsCacheService, useValue: analyticsCacheService },
        { provide: DerivedViewCacheService, useValue: derivedViewCacheService },
      ],
    }).compile();

    controller = module.get<PublicAnalyticsRecordController>(PublicAnalyticsRecordController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('recordAnalytics', () => {
    it('should call trackPageview when type is pageview with a path', async () => {
      const raw = { type: 'pageview', path: '/home', data: { articleId: 1 } };
      const ip = '127.0.0.1';
      const userAgent = 'Mozilla/5.0';

      await controller.recordAnalytics(raw, ip, userAgent);

      expect(analyticsService.recordAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pageview', path: '/home' }),
      );
      expect(analyticsCacheService.clear).toHaveBeenCalled();
      expect(derivedViewCacheService.clear).toHaveBeenCalled();
      expect(thirdPartyAnalyticsService.trackPageview).toHaveBeenCalledWith('/home', ip, userAgent);
    });

    it('should NOT call trackPageview when type is event', async () => {
      const raw = { type: 'event', data: { target: 'btn' } };

      await controller.recordAnalytics(raw);

      expect(analyticsService.recordAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'event' }),
      );
      expect(analyticsCacheService.clear).toHaveBeenCalled();
      expect(derivedViewCacheService.clear).toHaveBeenCalled();
      expect(thirdPartyAnalyticsService.trackPageview).not.toHaveBeenCalled();
    });

    it('should clear both caches on every call', async () => {
      const raw = { type: 'event', data: { target: 'link' } };

      await controller.recordAnalytics(raw);

      expect(analyticsCacheService.clear).toHaveBeenCalledTimes(1);
      expect(derivedViewCacheService.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordArticleView', () => {
    it('should delegate to articleStatsService.recordArticleView', async () => {
      const articleId = 42;
      const ip = '192.168.1.1';
      const userAgent = 'Chrome/120';

      await controller.recordArticleView(articleId, ip, userAgent);

      expect(articleStatsService.recordArticleView).toHaveBeenCalledWith(articleId, ip, userAgent);
    });

    it('should pass undefined userAgent when not provided', async () => {
      const articleId = 99;
      const ip = '10.0.0.1';

      await controller.recordArticleView(articleId, ip, undefined);

      expect(articleStatsService.recordArticleView).toHaveBeenCalledWith(articleId, ip, undefined);
    });
  });

  describe('recordReadingTime', () => {
    it('should delegate to articleStatsService.recordReadingTime', async () => {
      const articleId = 7;
      const duration = 300;
      const ip = '172.16.0.1';

      await controller.recordReadingTime(articleId, duration, ip);

      expect(articleStatsService.recordReadingTime).toHaveBeenCalledWith(articleId, duration, ip);
    });
  });
});
