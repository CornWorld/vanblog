import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { Mock } from '../../../test/mock';

import { ConfigService } from '../../config/config.service';
import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';

describe('SitemapController', () => {
  let controller: SitemapController;
  let sitemapService: SitemapService;

  beforeEach(async () => {
    // ✅ 优化：使用新的扁平化 Mock API
    const mockSitemapService = Mock.sitemap();
    // ✅ 优化：使用新的扁平化 Mock API
    const mockConfigService = Mock.config();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SitemapController],
      providers: [
        {
          provide: SitemapService,
          useValue: mockSitemapService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<SitemapController>(SitemapController);
    sitemapService = module.get(SitemapService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateSitemap_tsrest', () => {
    it('should generate sitemap successfully', async () => {
      vi.mocked(sitemapService.generateSitemapFn).mockResolvedValue();

      const handler = controller.generateSitemap_tsrest();
      const result = await handler({ params: {}, query: {}, body: {} });

      expect(sitemapService.generateSitemapFn).toHaveBeenCalledWith('手动触发');
      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        message: '站点地图生成成功',
      });
    });

    it('should handle sitemap generation errors', async () => {
      const error = new Error('Generation failed');
      vi.spyOn(sitemapService, 'generateSitemapFn').mockRejectedValue(error);

      const handler = controller.generateSitemap_tsrest();
      await expect(handler({ params: {}, query: {}, body: {} })).rejects.toThrow(
        'Generation failed',
      );
      expect(sitemapService.generateSitemapFn).toHaveBeenCalledWith('手动触发');
    });
  });

  describe('getSitemapStatus_tsrest', () => {
    it('should return sitemap status', async () => {
      const handler = controller.getSitemapStatus_tsrest();
      const result = await handler({ params: {}, query: {} });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        enabled: true,
        sitemapUrl: expect.stringContaining('/sitemap/sitemap.xml'),
      });
    });
  });

  describe('getSitemapUrls_tsrest', () => {
    it('should return sitemap URLs', async () => {
      const mockUrls = ['/', '/post/test', '/category/tech'];
      vi.spyOn(sitemapService, 'getSiteUrls').mockResolvedValue(mockUrls);

      const handler = controller.getSitemapUrls_tsrest();
      const result = await handler({ params: {}, query: {} });

      expect(sitemapService.getSiteUrls).toHaveBeenCalled();
      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        urls: mockUrls,
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      vi.spyOn(sitemapService, 'getSiteUrls').mockRejectedValue(error);

      const handler = controller.getSitemapUrls_tsrest();
      await expect(handler({ params: {}, query: {} })).rejects.toThrow('Service error');
      expect(sitemapService.getSiteUrls).toHaveBeenCalled();
    });
  });
});
