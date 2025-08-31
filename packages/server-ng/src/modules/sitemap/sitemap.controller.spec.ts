import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ConfigService } from '../../config/config.service';

import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';

describe('SitemapController', () => {
  let controller: SitemapController;
  let sitemapService: SitemapService;
  let configService: ConfigService;

  const mockSitemapService: Partial<SitemapService> = {
    generateSitemapFn: vi.fn(),
    getSiteUrls: vi.fn(),
  };

  // removed mockJwtAuthGuard and mockPermissionGuard

  const mockConfigService = {
    get: vi.fn((_key: string, defaultValue?: any) => defaultValue),
  } as unknown as ConfigService;

  beforeEach(async () => {
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
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateSitemap', () => {
    it('should generate sitemap successfully', async () => {
      vi.mocked(sitemapService.generateSitemapFn).mockResolvedValue();

      const result = await controller.generateSitemap();

      expect(sitemapService.generateSitemapFn).toHaveBeenCalledWith('手动触发');
      expect(result).toEqual({
        message: '站点地图生成成功',
      });
    });

    it('should handle sitemap generation errors', async () => {
      const error = new Error('Generation failed');
      vi.spyOn(sitemapService, 'generateSitemapFn').mockRejectedValue(error);

      await expect(controller.generateSitemap()).rejects.toThrow('Generation failed');
      expect(sitemapService.generateSitemapFn).toHaveBeenCalledWith('手动触发');
    });
  });

  describe('getSitemapStatus', () => {
    it('should return sitemap status', () => {
      const result = controller.getSitemapStatus();

      expect(result).toEqual({
        enabled: true,
        sitemapUrl: expect.stringContaining('/sitemap/sitemap.xml'),
      });
    });

    it('should handle custom base URL', () => {
      vi.spyOn(configService, 'get').mockImplementationOnce((key: string, defaultValue?: any) => {
        if (key === 'BASE_URL') return 'https://example.com';
        return defaultValue;
      });

      const result = controller.getSitemapStatus();

      expect(result.sitemapUrl).toBe('https://example.com/sitemap/sitemap.xml');
    });
  });

  describe('getSitemapUrls', () => {
    it('should return sitemap URLs', async () => {
      const mockUrls = ['/', '/post/test', '/category/tech'];
      vi.spyOn(sitemapService, 'getSiteUrls').mockResolvedValue(mockUrls);

      const result = await controller.getSitemapUrls();

      expect(sitemapService.getSiteUrls).toHaveBeenCalled();
      expect(result).toEqual({
        urls: mockUrls,
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      vi.spyOn(sitemapService, 'getSiteUrls').mockRejectedValue(error);

      await expect(controller.getSitemapUrls()).rejects.toThrow('Service error');
      expect(sitemapService.getSiteUrls).toHaveBeenCalled();
    });
  });
});
