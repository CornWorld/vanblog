import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ConfigService } from '../../config/config.service';

import { RssController } from './rss.controller';
import { RssService } from './rss.service';

describe('RssController', () => {
  let controller: RssController;
  let rssService: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [RssController],
      providers: [
        {
          provide: RssService,
          useValue: {
            generateRssFeedFn: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((_key: string, defaultValue?: any) => defaultValue),
          },
        },
      ],
    });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<RssController>(RssController);
    rssService = module.get<RssService>(RssService);
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
