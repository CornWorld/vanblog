import * as fs from 'fs/promises';
import * as path from 'path';

import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { articles, categories, tags } from '@vanblog/shared/drizzle';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

import { SitemapService } from './sitemap.service';

// Mock fs and path modules
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
}));
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
  let settingCoreService: SettingCoreService;

  const mockArticles = [
    {
      id: 1,
      pathname: 'test-article-1',
    },
    {
      id: 2,
      pathname: 'test-article-2',
    },
  ];

  const mockCategories = [{ name: 'Technology' }, { name: 'Life' }];

  const mockTags = [{ name: 'JavaScript' }, { name: 'TypeScript' }];

  beforeEach(async () => {
    const mockConfigService = {
      get: vi.fn(),
    };

    const mockHookService = {
      doAction: vi.fn(),
      applyFilters: vi.fn().mockImplementation((_hook: string, urls: string[]) => urls),
    };

    const mockSettingCoreService = {
      getConfig: vi.fn().mockResolvedValue('https://example.com'),
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
          provide: SettingCoreService,
          useValue: mockSettingCoreService,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: {}, // 将在后面重新定义
        },
      ],
    }).compile();

    service = module.get<SitemapService>(SitemapService);
    configService = module.get(ConfigService);
    hookService = module.get(HookService);
    settingCoreService = module.get(SettingCoreService);

    // Setup default mocks
    (configService.get as any).mockReturnValue('/tmp/static');

    // 创建一个更复杂的 mock 来处理不同的查询
    const dbMock = {
      select: vi.fn().mockImplementation((_fields) => {
        return {
          from: vi.fn().mockImplementation((_table) => {
            // 根据表名返回不同的数据
            if (_table === articles) {
              return {
                where: vi.fn().mockResolvedValue(
                  mockArticles.map((article) => ({
                    id: article.id,
                    pathname: article.pathname,
                  })),
                ),
              };
            }
            if (_table === categories) {
              return mockCategories;
            }
            if (_table === tags) {
              return mockTags;
            }
            return [];
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
    vi.mocked(fs.access).mockResolvedValue(undefined); // Default: directory exists
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
      // Reset mocks before test
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // Mock logger to avoid console output
      const loggerSpy = vi.spyOn(service['logger'], 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await service.generateSitemapFn('Test generation');

      // Check if there were any errors
      expect(errorSpy).not.toHaveBeenCalled();

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

      loggerSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should create directory if it does not exist', async () => {
      // Reset mocks before test
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      // Mock fs.access to throw error (directory doesn't exist)
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));

      // Mock logger to avoid console output
      const loggerSpy = vi.spyOn(service['logger'], 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await service.generateSitemapFn('Test generation');

      // Check if there were any errors
      expect(errorSpy).not.toHaveBeenCalled();

      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/static/sitemap', { recursive: true });

      loggerSpy.mockRestore();
      errorSpy.mockRestore();
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

  describe('getPageUrls', () => {
    it('should fall back to default pageSize when config is null', async () => {
      // 2 articles mocked in beforeEach, fallback 5 => totalPages=1
      (settingCoreService.getConfig as any).mockResolvedValueOnce(null);
      const paths = await service.getPageUrls();
      expect(paths).toEqual(['/page/1']);
    });

    it('should fall back to default pageSize when config is non-positive', async () => {
      (settingCoreService.getConfig as any).mockResolvedValueOnce(0);
      const paths = await service.getPageUrls();
      expect(paths).toEqual(['/page/1']);
    });

    it('should respect configured pageSize when it is a positive number', async () => {
      (settingCoreService.getConfig as any).mockResolvedValueOnce(10);
      const paths = await service.getPageUrls();
      // 2 articles, pageSize 10 => totalPages=1
      expect(paths).toEqual(['/page/1']);
    });
  });

  // Additional cases
  describe('generateSitemapFn - normalization & hook payload', () => {
    it('should normalize, same-origin filter, dedupe and sort urls then pass to beforeGenerate', async () => {
      // ensure FS ok
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // keep baseUrl as default https://example.com
      (settingCoreService.getConfig as any).mockImplementation(async (key: string) => {
        if (key === 'baseUrl') return await Promise.resolve('https://example.com');
        return await Promise.resolve(null);
      });

      // craft raw urls with mix
      const rawUrls = [
        '/',
        '/b',
        '/a',
        '/a',
        'https://example.com/page/2',
        'https://example.com',
        'https://example.com/',
        'https://example.com/post/abc?x=1',
        'https://other.com/page/3',
        '',
        'post/no-leading-slash',
        '  /trailing/ ',
        '//double//slashes///',
      ];
      vi.spyOn(service, 'getSiteUrls').mockResolvedValue(rawUrls);

      await service.generateSitemapFn('test');

      const expected = [
        '/',
        '/a',
        '/b',
        '/page/2',
        '/post/abc',
        '/post/no-leading-slash',
        '/trailing',
        '/double/slashes',
      ];
      const expectedSorted = [...expected].sort();

      const { calls } = vi.mocked(hookService.doAction).mock;
      const beforeArgs = calls.find(([name]) => name === 'sitemap|beforeGenerate');
      expect(beforeArgs).toBeTruthy();
      const [, payload] = beforeArgs as [string, { siteUrl: string; urls: string[] }];
      expect(payload.siteUrl).toBe('https://example.com/');
      // ensure sorted
      expect(payload.urls).toEqual([...payload.urls].sort());
      // ensure expected set
      expect(payload.urls).toEqual(expectedSorted);
    });
  });

  describe('getSiteUrls - extra static paths from settings', () => {
    it('should include extra static paths from string[] and ignore invalid items', async () => {
      (settingCoreService.getConfig as any).mockImplementation(async (key: string) => {
        if (key === 'sitemapExtraStaticPaths')
          return await Promise.resolve(['/extra', 'invalid', '/more']);
        if (key === 'baseUrl') return await Promise.resolve('https://example.com');
        return await Promise.resolve(null);
      });

      const urls = await service.getSiteUrls();

      expect(urls).toContain('/');
      expect(urls).toContain('/extra');
      expect(urls).toContain('/more');
      expect(urls).not.toContain('invalid');
    });

    it('should include extra static path from string value', async () => {
      (settingCoreService.getConfig as any).mockImplementation(async (key: string) => {
        if (key === 'sitemapExtraStaticPaths') return await Promise.resolve('   /one ');
        if (key === 'baseUrl') return await Promise.resolve('https://example.com');
        return await Promise.resolve(null);
      });

      const urls = await service.getSiteUrls();

      expect(urls).toContain('/one');
    });

    it('should ignore setting read errors silently', async () => {
      (settingCoreService.getConfig as any).mockImplementation(async (key: string) => {
        if (key === 'sitemapExtraStaticPaths') throw new Error('Setting error');
        if (key === 'baseUrl') return await Promise.resolve('https://example.com');
        return await Promise.resolve(null);
      });

      const urls = await service.getSiteUrls();

      expect(urls).toContain('/');
      expect(urls).toContain('/category');
      expect(urls).toContain('/tag');
    });
  });

  describe('getArticleUrls', () => {
    it('should return article URLs with pathname', async () => {
      const mockArticles = [
        { id: 1, pathname: 'custom-path' },
        { id: 2, pathname: 'another-path' },
      ];

      Object.defineProperty(service, 'db', {
        value: {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockArticles),
            }),
          }),
        },
        writable: true,
      });

      const urls = await service.getArticleUrls();

      expect(urls).toContain('/post/custom-path');
      expect(urls).toContain('/post/another-path');
    });

    it('should use id when pathname is null', async () => {
      const mockArticles = [
        { id: 1, pathname: null },
        { id: 2, pathname: null },
      ];

      Object.defineProperty(service, 'db', {
        value: {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockArticles),
            }),
          }),
        },
        writable: true,
      });

      const urls = await service.getArticleUrls();

      expect(urls).toContain('/post/1');
      expect(urls).toContain('/post/2');
    });
  });

  describe('getCategoryUrls', () => {
    it('should return encoded category URLs', async () => {
      const mockCategories = [{ name: 'Tech & Science' }, { name: '中文分类' }];

      Object.defineProperty(service, 'db', {
        value: {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockResolvedValue(mockCategories),
          }),
        },
        writable: true,
      });

      const urls = await service.getCategoryUrls();

      expect(urls).toContain('/category/Tech%20%26%20Science');
      expect(urls).toContain(`/category/${encodeURIComponent('中文分类')}`);
    });
  });

  describe('getTagUrls', () => {
    it('should return encoded tag URLs', async () => {
      const mockTags = [{ name: 'JavaScript' }, { name: 'Node.js' }];

      Object.defineProperty(service, 'db', {
        value: {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockResolvedValue(mockTags),
          }),
        },
        writable: true,
      });

      const urls = await service.getTagUrls();

      expect(urls).toContain('/tag/JavaScript');
      expect(urls).toContain('/tag/Node.js');
    });
  });

  describe('getPageUrls', () => {
    it('should generate correct number of pages', async () => {
      (settingCoreService.getConfig as any).mockResolvedValue(10);

      Object.defineProperty(service, 'db', {
        value: {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 25 }]),
            }),
          }),
        },
        writable: true,
      });

      const urls = await service.getPageUrls();

      expect(urls).toHaveLength(3);
      expect(urls).toContain('/page/1');
      expect(urls).toContain('/page/2');
      expect(urls).toContain('/page/3');
    });

    it('should handle zero articles', async () => {
      (settingCoreService.getConfig as any).mockResolvedValue(10);

      let selectCallCount = 0;
      Object.defineProperty(service, 'db', {
        value: {
          select: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue([{ count: 0 }]),
                }),
              };
            } else {
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue([]),
                }),
              };
            }
          }),
        },
        writable: true,
      });

      const urls = await service.getPageUrls();

      expect(urls).toHaveLength(0);
    });

    it('should fallback to list length when count fails', async () => {
      (settingCoreService.getConfig as any).mockResolvedValue(5);

      let selectCallCount = 0;
      Object.defineProperty(service, 'db', {
        value: {
          select: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockRejectedValue(new Error('Count failed')),
                }),
              };
            } else {
              return {
                from: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]),
                }),
              };
            }
          }),
        },
        writable: true,
      });

      const urls = await service.getPageUrls();

      expect(urls).toHaveLength(1);
      expect(urls).toContain('/page/1');
    });
  });

  describe('generateSitemap', () => {
    it('should debounce sitemap generation', async () => {
      vi.useFakeTimers();

      const generateSpy = vi.spyOn(service, 'generateSitemapFn');

      service.generateSitemap('First call', 1000);
      service.generateSitemap('Second call', 1000);
      service.generateSitemap('Third call', 1000);

      expect(generateSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      expect(generateSpy).toHaveBeenCalledTimes(1);
      expect(generateSpy).toHaveBeenCalledWith('Third call');

      vi.useRealTimers();
    });

    it('should use default delay when not provided', () => {
      vi.useFakeTimers();

      const generateSpy = vi.spyOn(service, 'generateSitemapFn');

      service.generateSitemap('Test');

      vi.advanceTimersByTime(60000);

      expect(generateSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('washUrl', () => {
    it('should add trailing slash if missing', () => {
      const result = service['washUrl']('https://example.com');
      expect(result).toBe('https://example.com/');
    });

    it('should not add trailing slash if already present', () => {
      const result = service['washUrl']('https://example.com/');
      expect(result).toBe('https://example.com/');
    });

    it('should handle empty string', () => {
      const result = service['washUrl']('');
      expect(result).toBe('http://localhost:3000/');
    });
  });

  describe('dedupe', () => {
    it('should remove duplicate URLs', () => {
      const urls = ['/', '/post/1', '/', '/post/2', '/post/1'];
      const result = service['dedupe'](urls);
      expect(result).toEqual(['/', '/post/1', '/post/2']);
    });

    it('should preserve order of first occurrence', () => {
      const urls = ['/a', '/b', '/a', '/c', '/b'];
      const result = service['dedupe'](urls);
      expect(result).toEqual(['/a', '/b', '/c']);
    });
  });

  describe('normalizeUrls', () => {
    it('should normalize relative paths', () => {
      const urls = ['/post/1', 'category/tech', '//double//slashes'];
      const result = service['normalizeUrls']('https://example.com', urls);
      expect(result).toContain('/post/1');
      expect(result).toContain('/category/tech');
      expect(result).toContain('/double/slashes');
    });

    it('should filter out cross-origin URLs', () => {
      const urls = ['https://example.com/post/1', 'https://other.com/post/2'];
      const result = service['normalizeUrls']('https://example.com', urls);
      expect(result).toContain('/post/1');
      expect(result).not.toContain('/post/2');
    });

    it('should remove trailing slashes except for root', () => {
      const urls = ['/', '/post/1/', '/category/tech/'];
      const result = service['normalizeUrls']('https://example.com', urls);
      expect(result).toContain('/');
      expect(result).toContain('/post/1');
      expect(result).toContain('/category/tech');
    });

    it('should handle empty strings', () => {
      const urls = ['', '  ', '/valid'];
      const result = service['normalizeUrls']('https://example.com', urls);
      expect(result).toContain('/valid');
      expect(result).not.toContain('');
    });

    it('should handle malformed URLs gracefully', () => {
      const urls = ['ht tp://invalid', '/valid', 'just-text'];
      const result = service['normalizeUrls']('https://example.com', urls);
      expect(result).toContain('/valid');
      expect(result).toContain('/just-text');
    });
  });

  describe('getChangeFreq', () => {
    it('should return correct frequency for root', () => {
      const freq = service['getChangeFreq']('/');
      expect(freq).toBe('daily');
    });

    it('should return correct frequency for posts', () => {
      const freq = service['getChangeFreq']('/post/test');
      expect(freq).toBe('weekly');
    });

    it('should return correct frequency for categories', () => {
      const freq = service['getChangeFreq']('/category/tech');
      expect(freq).toBe('weekly');
    });

    it('should return correct frequency for tags', () => {
      const freq = service['getChangeFreq']('/tag/javascript');
      expect(freq).toBe('weekly');
    });

    it('should return correct frequency for pages', () => {
      const freq = service['getChangeFreq']('/page/1');
      expect(freq).toBe('daily');
    });

    it('should return correct frequency for other URLs', () => {
      const freq = service['getChangeFreq']('/about');
      expect(freq).toBe('monthly');
    });
  });

  describe('getPriority', () => {
    it('should return correct priority for root', () => {
      const priority = service['getPriority']('/');
      expect(priority).toBe(1.0);
    });

    it('should return correct priority for posts', () => {
      const priority = service['getPriority']('/post/test');
      expect(priority).toBe(0.8);
    });

    it('should return correct priority for categories', () => {
      const priority = service['getPriority']('/category/tech');
      expect(priority).toBe(0.6);
    });

    it('should return correct priority for tags', () => {
      const priority = service['getPriority']('/tag/javascript');
      expect(priority).toBe(0.6);
    });

    it('should return correct priority for pages', () => {
      const priority = service['getPriority']('/page/1');
      expect(priority).toBe(0.5);
    });

    it('should return correct priority for other URLs', () => {
      const priority = service['getPriority']('/about');
      expect(priority).toBe(0.4);
    });
  });

  describe('hook integration', () => {
    it('should apply sitemap|collect_urls filter', async () => {
      const extraUrls = ['/custom-1', '/custom-2'];
      (hookService.applyFilters as any).mockImplementation(
        async (_hook: string, urls: string[]) => {
          return [...urls, ...extraUrls];
        },
      );

      const urls = await service.getSiteUrls();

      expect(hookService.applyFilters).toHaveBeenCalledWith(
        'sitemap|collect_urls',
        expect.any(Array),
      );
      expect(urls).toContain('/custom-1');
      expect(urls).toContain('/custom-2');
    });

    it('should handle hook errors gracefully', async () => {
      (hookService.applyFilters as any).mockRejectedValue(new Error('Hook error'));

      const urls = await service.getSiteUrls();

      expect(urls).toBeDefined();
      expect(Array.isArray(urls)).toBe(true);
    });

    it('should trigger beforeGenerate hook with correct data', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const loggerSpy = vi.spyOn(service['logger'], 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await service.generateSitemapFn('Test');

      expect(errorSpy).not.toHaveBeenCalled();
      expect(hookService.doAction).toHaveBeenCalledWith(
        'sitemap|beforeGenerate',
        expect.objectContaining({
          urls: expect.any(Array),
          siteUrl: expect.any(String),
        }),
      );

      loggerSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should trigger afterGenerate hook with correct data', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const loggerSpy = vi.spyOn(service['logger'], 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await service.generateSitemapFn('Test');

      expect(errorSpy).not.toHaveBeenCalled();
      expect(hookService.doAction).toHaveBeenCalledWith(
        'sitemap|afterGenerate',
        expect.objectContaining({
          sitemapPath: expect.any(String),
          file: 'sitemap.xml',
        }),
      );

      loggerSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should handle hook errors without breaking sitemap generation', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      (hookService.doAction as any).mockRejectedValue(new Error('Hook error'));

      const loggerSpy = vi.spyOn(service['logger'], 'log').mockImplementation(() => {});
      const loggerErrorSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await service.generateSitemapFn('Test');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error in sitemap|beforeGenerate hook:',
        expect.any(Error),
      );
      expect(fs.writeFile).toHaveBeenCalled();

      loggerSpy.mockRestore();
      loggerErrorSpy.mockRestore();
    });
  });
});
