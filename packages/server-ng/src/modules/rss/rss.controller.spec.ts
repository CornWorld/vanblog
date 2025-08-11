import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import { RssController } from './rss.controller';
import { RssService } from './rss.service';

describe('RssController', () => {
  let controller: RssController;
  let rssService: any;

  const mockRssService = {
    generateRssFeedFn: vi.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: vi.fn().mockReturnValue(true),
  };

  const mockPermissionGuard = {
    canActivate: vi.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RssController],
      providers: [
        {
          provide: RssService,
          useValue: mockRssService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(PermissionsGuard)
      .useValue(mockPermissionGuard)
      .compile();

    controller = module.get<RssController>(RssController);
    rssService = module.get(RssService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateRss', () => {
    it('should generate RSS feed successfully', async () => {
      rssService.generateRssFeedFn.mockResolvedValue();

      const result = await controller.generateRss();

      expect(rssService.generateRssFeedFn).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'RSS 订阅源生成成功',
      });
    });

    it('should handle RSS generation errors', async () => {
      const error = new Error('Generation failed');
      rssService.generateRssFeedFn.mockRejectedValue(error);

      await expect(controller.generateRss()).rejects.toThrow('Generation failed');
      expect(rssService.generateRssFeedFn).toHaveBeenCalled();
    });
  });

  describe('getRssStatus', () => {
    it('should return RSS status', () => {
      const result = controller.getRssStatus();

      expect(result).toEqual({
        enabled: true,
        feedUrls: {
          xml: expect.stringContaining('/rss/feed.xml'),
          json: expect.stringContaining('/rss/feed.json'),
          atom: expect.stringContaining('/rss/atom.xml'),
        },
      });
    });
  });
});
