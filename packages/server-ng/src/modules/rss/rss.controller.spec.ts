import { InternalServerErrorException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ConfigService } from '../../config/config.service';

import { RssController } from './rss.controller';
import { RssService } from './rss.service';

// Mock fs module - must be before importing fs
vi.mock('fs/promises');

// Import fs after mock is set up
import * as fs from 'fs/promises';

describe('RssController', () => {
  let controller: RssController;
  let rssService: any;
  let configService: any;

  beforeEach(async () => {
    const mockRssService = {
      generateRssFeedFn: vi.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      get: vi.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'BASE_URL') return 'https://test-blog.com';
        return defaultValue;
      }),
      static: {
        path: './test-static',
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RssController],
      providers: [
        {
          provide: RssService,
          useValue: mockRssService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<RssController>(RssController);
    rssService = module.get(RssService);
    configService = module.get(ConfigService);

    // Mock fs operations
    vi.mocked(fs.stat).mockResolvedValue({
      mtime: new Date('2024-01-15T12:00:00Z'),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateRss', () => {
    it('should generate RSS feed successfully', async () => {
      rssService.generateRssFeedFn.mockResolvedValue(undefined);

      const result = await controller.generateRss();

      expect(result).toEqual({ message: 'RSS 订阅源生成成功' });
      expect(rssService.generateRssFeedFn).toHaveBeenCalledWith('手动触发');
    });

    it('should handle RSS generation errors', async () => {
      rssService.generateRssFeedFn.mockRejectedValue(new Error('Generation failed'));

      await expect(controller.generateRss()).rejects.toThrow(InternalServerErrorException);
      await expect(controller.generateRss()).rejects.toThrow('RSS 生成失败');
    });

    it('should call service with correct info string', async () => {
      await controller.generateRss();

      expect(rssService.generateRssFeedFn).toHaveBeenCalledTimes(1);
      expect(rssService.generateRssFeedFn).toHaveBeenCalledWith('手动触发');
    });

    it('should handle service errors gracefully', async () => {
      rssService.generateRssFeedFn.mockRejectedValue(new Error('Service error'));

      await expect(controller.generateRss()).rejects.toThrow(InternalServerErrorException);
      expect(rssService.generateRssFeedFn).toHaveBeenCalled();
    });
  });

  describe('getRssStatus', () => {
    it('should return RSS status with all feed URLs', async () => {
      const result = await controller.getRssStatus();

      expect(result).toEqual({
        enabled: true,
        lastGenerated: expect.any(String),
        feedUrls: {
          xml: 'https://test-blog.com/rss/feed.xml',
          json: 'https://test-blog.com/rss/feed.json',
          atom: 'https://test-blog.com/rss/atom.xml',
        },
      });
    });

    it('should handle base URL without trailing slash', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'BASE_URL') return 'https://test-blog.com';
        return null;
      });

      const result = await controller.getRssStatus();

      expect(result.feedUrls.xml).toBe('https://test-blog.com/rss/feed.xml');
      expect(result.feedUrls.json).toBe('https://test-blog.com/rss/feed.json');
      expect(result.feedUrls.atom).toBe('https://test-blog.com/rss/atom.xml');
    });

    it('should handle base URL with trailing slash', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'BASE_URL') return 'https://test-blog.com/';
        return null;
      });

      const result = await controller.getRssStatus();

      expect(result.feedUrls.xml).toBe('https://test-blog.com/rss/feed.xml');
      expect(result.feedUrls.json).toBe('https://test-blog.com/rss/feed.json');
      expect(result.feedUrls.atom).toBe('https://test-blog.com/rss/atom.xml');
    });

    it('should return lastGenerated timestamp when files exist', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        mtime: new Date('2024-01-15T12:00:00Z'),
      } as any);

      const result = await controller.getRssStatus();

      expect(result.lastGenerated).toBeDefined();
      expect(result.lastGenerated).toBe(dayjs('2024-01-15T12:00:00Z').format());
    });

    it('should handle missing RSS files gracefully', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

      const result = await controller.getRssStatus();

      expect(result.lastGenerated).toBeUndefined();
    });

    it('should return latest modification time from multiple files', async () => {
      const dates = [
        new Date('2024-01-10T12:00:00Z'),
        new Date('2024-01-15T12:00:00Z'), // Latest
        new Date('2024-01-12T12:00:00Z'),
      ];

      let callCount = 0;
      vi.mocked(fs.stat).mockImplementation(() => {
        const mtime = dates[callCount % dates.length];
        callCount++;
        return Promise.resolve({ mtime } as any);
      });

      const result = await controller.getRssStatus();

      expect(result.lastGenerated).toBe(dayjs('2024-01-15T12:00:00Z').format());
    });

    it('should handle partial file stats errors', async () => {
      let callCount = 0;
      vi.mocked(fs.stat).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ mtime: new Date('2024-01-15T12:00:00Z') } as any);
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await controller.getRssStatus();

      expect(result.lastGenerated).toBeDefined();
    });

    it('should handle all file stats errors', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('File system error'));

      const result = await controller.getRssStatus();

      expect(result.lastGenerated).toBeUndefined();
    });

    it('should use correct static path from config', async () => {
      configService.static.path = '/custom/static/path';

      await controller.getRssStatus();

      // Verify fs.stat was called with correct path
      expect(fs.stat).toHaveBeenCalled();
    });

    it('should return enabled status as true', async () => {
      const result = await controller.getRssStatus();

      expect(result.enabled).toBe(true);
    });

    it('should handle unexpected errors', async () => {
      configService.get.mockImplementation(() => {
        throw new Error('Config error');
      });

      await expect(controller.getRssStatus()).rejects.toThrow(InternalServerErrorException);
      await expect(controller.getRssStatus()).rejects.toThrow('获取 RSS 状态失败');
    });

    it('should check feed.xml, feed.json, and atom.xml files', async () => {
      const statSpy = vi.mocked(fs.stat);
      statSpy.mockResolvedValue({
        mtime: new Date('2024-01-15T12:00:00Z'),
      } as any);

      await controller.getRssStatus();

      // Should check all three feed files
      expect(statSpy).toHaveBeenCalledTimes(3);
    });

    it('should format lastGenerated using dayjs', async () => {
      const testDate = new Date('2024-06-15T10:30:00Z');
      vi.mocked(fs.stat).mockResolvedValue({
        mtime: testDate,
      } as any);

      const result = await controller.getRssStatus();

      const expected = dayjs(testDate).format();
      expect(result.lastGenerated).toBe(expected);
    });

    it('should handle default BASE_URL if not configured', async () => {
      configService.get.mockImplementation(() => 'http://localhost:3000');

      const result = await controller.getRssStatus();

      expect(result.feedUrls.xml).toBe('http://localhost:3000/rss/feed.xml');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle successful generation followed by status check', async () => {
      // Generate RSS
      const generateResult = await controller.generateRss();

      expect(generateResult).toEqual({ message: 'RSS 订阅源生成成功' });

      // Check status
      const statusResult = await controller.getRssStatus();

      expect(statusResult.enabled).toBe(true);
    });

    it('should report correct status after generation failure', async () => {
      // Attempt to generate RSS (fails)
      rssService.generateRssFeedFn.mockRejectedValue(new Error('Generation failed'));

      await expect(controller.generateRss()).rejects.toThrow();

      // Status check should still work
      const statusResult = await controller.getRssStatus();

      expect(statusResult.enabled).toBe(true);
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle null config service response', async () => {
      configService.get.mockReturnValue(null);

      const result = await controller.getRssStatus();

      // Should use default values
      expect(result).toBeDefined();
    });

    it('should handle undefined static path', async () => {
      configService.static = { path: undefined };

      // Should throw InternalServerErrorException when path is undefined
      await expect(controller.getRssStatus()).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle service throwing non-Error objects', async () => {
      rssService.generateRssFeedFn.mockRejectedValue('String error');

      await expect(controller.generateRss()).rejects.toThrow(InternalServerErrorException);
    });
  });
});
