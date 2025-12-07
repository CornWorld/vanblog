import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { RssService } from './rss.service';

describe('RssController', () => {
  let rssService: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      providers: [
        {
          provide: RssService,
          useValue: {
            generateRssFeedFn: vi.fn(),
          },
        },
      ],
    });

    const module: TestingModule = await moduleBuilder.compile();

    rssService = module.get<RssService>(RssService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(rssService).toBeDefined();
  });

  describe('generateRss', () => {
    it('should generate RSS feed successfully', async () => {
      rssService.generateRssFeedFn.mockResolvedValue(undefined);

      await expect(rssService.generateRssFeedFn('test')).resolves.not.toThrow();
      expect(rssService.generateRssFeedFn).toHaveBeenCalledWith('test');
    });

    it('should handle RSS generation errors', async () => {
      const error = new Error('Generation failed');
      rssService.generateRssFeedFn.mockRejectedValue(error);

      await expect(rssService.generateRssFeedFn('test')).rejects.toThrow('Generation failed');
      expect(rssService.generateRssFeedFn).toHaveBeenCalled();
    });
  });
});
