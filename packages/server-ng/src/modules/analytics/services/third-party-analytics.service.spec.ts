import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { ThirdPartyAnalyticsService } from './third-party-analytics.service';

vi.mock('axios');

describe('ThirdPartyAnalyticsService', () => {
  let service: ThirdPartyAnalyticsService;
  let configService: ConfigService;

  beforeEach(async () => {
    // 使用 MockUtils 创建 ConfigService Mock
    configService = Mock.config({
      GOOGLE_ANALYTICS_ID: 'UA-123456789-1',
      BAIDU_ANALYTICS_ID: 'baidu123',
    }) as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThirdPartyAnalyticsService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<ThirdPartyAnalyticsService>(ThirdPartyAnalyticsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('trackPageview', () => {
    it('should send pageview to Google Analytics when tracking ID is configured', async () => {
      const mockPost = vi.mocked(axios.post).mockResolvedValue({ data: {} } as never);

      await service.trackPageview('/test-page', '192.168.1.1', 'Mozilla/5.0');

      expect(mockPost).toHaveBeenCalledWith(
        'https://www.google-analytics.com/collect',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            v: '1',
            tid: 'UA-123456789-1',
            t: 'pageview',
            dp: '/test-page',
            uip: '192.168.1.1',
            ua: 'Mozilla/5.0',
          }),
          timeout: 5000,
        }),
      );
    });

    it('should send pageview to Baidu Analytics when site ID is configured', async () => {
      const mockGet = vi.mocked(axios.get).mockResolvedValue({ data: {} } as never);

      await service.trackPageview('/test-page', '192.168.1.1');

      expect(mockGet).toHaveBeenCalledWith(
        'https://hm.baidu.com/hm.gif',
        expect.objectContaining({
          params: expect.objectContaining({
            si: 'baidu123',
            su: '/test-page',
          }),
          timeout: 5000,
        }),
      );
    });

    it('should not send analytics when tracking IDs are not configured', async () => {
      // 创建没有分析ID的配置服务
      const emptyConfigService = Mock.config() as unknown as ConfigService;
      const newService = new ThirdPartyAnalyticsService(emptyConfigService);

      await newService.trackPageview('/test-page');

      expect(axios.post).not.toHaveBeenCalled();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Network error'));
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(service.trackPageview('/test-page')).resolves.toBeUndefined();
    });
  });

  describe('trackEvent', () => {
    it('should send event to Google Analytics', async () => {
      const mockPost = vi.mocked(axios.post).mockResolvedValue({ data: {} } as never);

      await service.trackEvent('Category', 'Action', 'Label', 100);

      expect(mockPost).toHaveBeenCalledWith(
        'https://www.google-analytics.com/collect',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            v: '1',
            tid: 'UA-123456789-1',
            t: 'event',
            ec: 'Category',
            ea: 'Action',
            el: 'Label',
            ev: '100',
          }),
        }),
      );
    });

    it('should not send event when Google Analytics ID is not configured', async () => {
      // 创建没有Google Analytics ID的配置服务
      const emptyConfigService = Mock.config() as unknown as ConfigService;
      const newService = new ThirdPartyAnalyticsService(emptyConfigService);

      await newService.trackEvent('Category', 'Action');

      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('trackArticleView', () => {
    it('should track both event and pageview for article', async () => {
      vi.mocked(axios.post).mockResolvedValue({ data: {} } as never);
      vi.mocked(axios.get).mockResolvedValue({ data: {} } as never);

      await service.trackArticleView(123, 'Test Article', '192.168.1.1');

      // Should track event
      expect(axios.post).toHaveBeenCalledWith(
        'https://www.google-analytics.com/collect',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            t: 'event',
            ec: 'Article',
            ea: 'View',
            el: 'Test Article',
            ev: '123',
          }),
        }),
      );

      // Should track pageview
      expect(axios.post).toHaveBeenCalledWith(
        'https://www.google-analytics.com/collect',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            t: 'pageview',
            dp: '/article/123',
          }),
        }),
      );
    });
  });
});
