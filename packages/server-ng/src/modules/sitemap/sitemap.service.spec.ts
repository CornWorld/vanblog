import * as fs from 'fs/promises';
import * as path from 'path';

import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { articles, categories, tags, siteMeta } from '../../database/schema';
import { HookService } from '../plugin/services/hook.service';

import { SitemapService } from './sitemap.service';

// Mock fs and path modules
vi.mock('fs/promises');
vi.mock('path');
vi.mock('sitemap', () => ({
  SitemapStream: vi.fn().mockImplementation(() => ({
    write: vi.fn(),
    end: vi.fn(),
  })),
  streamToPromise: vi
    .fn()
    .mockResolvedValue(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
    ),
}));

describe('SitemapService', () => {
  let service: SitemapService;
  let configService: ConfigService;
  let hookService: HookService;

  const mockArticles = [
    {
      id: 1,
      pathname: 'test-article-1',
      title: 'Test Article 1',
      content: 'Test content 1',
      hidden: false,
      private: false,
    },
    {
      id: 2,
      pathname: 'test-article-2',
      title: 'Test Article 2',
      content: 'Test content 2',
      hidden: false,
      private: false,
    },
  ];

  const mockCategories = [{ name: 'Technology' }, { name: 'Life' }];

  const mockTags = [{ name: 'JavaScript' }, { name: 'TypeScript' }];

  const mockSiteMeta = [
    { key: 'baseUrl', value: 'https://example.com' },
    { key: 'siteName', value: 'Test Blog' },
  ];

  beforeEach(async () => {
    const mockConfigService = {
      get: vi.fn(),
    };

    const mockHookService = {
      doAction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitemapService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
        {
          provide: 'DATABASE_CONNECTION',
          useValue: {}, // 将在后面重新定义
        },
      ],
    }).compile();

    service = module.get<SitemapService>(SitemapService);
    configService = module.get(ConfigService);
    hookService = module.get(HookService);

    // Setup default mocks
    configService.get.mockReturnValue('/tmp/static');

    // 创建一个更复杂的 mock 来处理不同的查询
    const dbMock = {
      select: vi.fn().mockImplementation((_fields) => {
        return {
          from: vi.fn().mockImplementation((_table) => {
            // 根据表名返回不同的数据
            if (_table === siteMeta) {
              return Promise.resolve(mockSiteMeta);
            }
            if (_table === articles) {
              return {
                where: vi.fn().mockResolvedValue(mockArticles),
              };
            }
            if (_table === categories) {
              return Promise.resolve(mockCategories);
            }
            if (_table === tags) {
              return Promise.resolve(mockTags);
            }
            return Promise.resolve([]);
          }),
        };
      }),
    };

    Object.defineProperty(service, 'db', {
      value: dbMock,
      writable: true,
    });

    // Mock fs operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSitemapFn', () => {
    it('should generate sitemap successfully', async () => {
      await service.generateSitemapFn('Test generation');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/tmp/static/sitemap/sitemap.xml',
        expect.stringContaining('<?xml version="1.0" encoding="UTF-8"?>'),
      );
      expect(hookService.doAction).toHaveBeenCalledWith(
        'sitemap|beforeGenerate',
        expect.any(Object),
      );
      expect(hookService.doAction).toHaveBeenCalledWith(
        'sitemap|afterGenerate',
        expect.any(Object),
      );
    });

    it('should create directory if it does not exist', async () => {
      // Mock fs.access to throw error (directory doesn't exist)
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));

      await service.generateSitemapFn('Test generation');

      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/static/sitemap', { recursive: true });
    });

    it('should handle errors gracefully', async () => {
      const loggerSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});

      // Mock database error
      Object.defineProperty(service, 'db', {
        value: {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        },
        writable: true,
      });

      await service.generateSitemapFn();

      expect(loggerSpy).toHaveBeenCalledWith('生成站点地图失败！');
      expect(loggerSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(loggerSpy).toHaveBeenCalledWith('Error message: Database error');
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Error stack:'));
    });
  });

  describe('getSiteUrls', () => {
    it('should return all site URLs', async () => {
      // Mock all URL methods
      vi.spyOn(service, 'getArticleUrls').mockResolvedValue(['/post/test-1', '/post/test-2']);
      vi.spyOn(service, 'getCategoryUrls').mockResolvedValue(['/category/tech', '/category/life']);
      vi.spyOn(service, 'getTagUrls').mockResolvedValue(['/tag/js', '/tag/ts']);
      vi.spyOn(service, 'getPageUrls').mockResolvedValue(['/page/1', '/page/2']);

      const urls = await service.getSiteUrls();

      expect(urls).toContain('/');
      expect(urls).toContain('/category');
      expect(urls).toContain('/tag');
      expect(urls).toContain('/timeline');
      expect(urls).toContain('/about');
      expect(urls).toContain('/link');
      expect(urls).toContain('/post/test-1');
      expect(urls).toContain('/category/tech');
      expect(urls).toContain('/tag/js');
      expect(urls).toContain('/page/1');
    });
  });

  describe('getArticleUrls', () => {
    it('should return article URLs', async () => {
      const mockArticleSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 1, pathname: 'test-article' },
            { id: 2, pathname: null },
          ]),
        }),
      };

      Object.defineProperty(service, 'db', {
        value: {
          select: vi.fn().mockReturnValue(mockArticleSelect),
        },
        writable: true,
      });

      const urls = await service.getArticleUrls();

      expect(urls).toEqual(['/post/test-article', '/post/2']);
    });
  });

  describe('generateSitemap', () => {
    it('should debounce sitemap generation', () => {
      vi.useFakeTimers();
      const generateSpy = vi.spyOn(service, 'generateSitemapFn').mockResolvedValue();

      service.generateSitemap('Test', 1000);
      service.generateSitemap('Test', 1000);
      service.generateSitemap('Test', 1000);

      expect(generateSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      expect(generateSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
