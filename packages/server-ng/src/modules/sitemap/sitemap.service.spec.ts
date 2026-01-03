import * as fs from 'fs/promises';
import * as path from 'path';

import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { Mock } from '../../../test/mock';

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
  SitemapStream: vi.fn(function (this: any) {
    this.write = vi.fn();
    this.end = vi.fn();
  }),
  streamToPromise: vi
    .fn()
    .mockResolvedValue(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
    ),
}));

describe('SitemapService', () => {
  let service: SitemapService;
  let hookService: any;
  let settingCoreService: any;
  let dbMock: any;

  beforeEach(async () => {
    hookService = Mock.hook();
    hookService.applyFilters = vi
      .fn()
      .mockImplementation((_hook: string, urls: string[]) => Promise.resolve(urls));

    settingCoreService = {
      getConfig: vi.fn().mockResolvedValue('https://example.com'),
    };

    const configService = Mock.config({
      'static.path': '/tmp/static',
    });

    // Create database mock with test articles
    const databaseMockBuilder = Mock.db();
    databaseMockBuilder.setQueryResult([
      { id: 1, pathname: 'test-article-1' },
      { id: 2, pathname: 'test-article-2' },
    ]);
    dbMock = databaseMockBuilder.build();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitemapService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: HookService,
          useValue: hookService,
        },
        {
          provide: SettingCoreService,
          useValue: settingCoreService,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: dbMock,
        },
      ],
    }).compile();

    service = module.get<SitemapService>(SitemapService);

    // Mock fs operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
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
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const loggerSpy = vi.spyOn(service['logger'], 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await service.generateSitemapFn('Test generation');

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
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));

      const loggerSpy = vi.spyOn(service['logger'], 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});

      await service.generateSitemapFn('Test generation');

      expect(errorSpy).not.toHaveBeenCalled();
      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/static/sitemap', { recursive: true });

      loggerSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const loggerSpy = vi.spyOn(service['logger'], 'error').mockImplementation(() => {});

      const dbMockError = Mock.db();
      dbMockError.setQueryResult([]);
      const dbMockErrorBuilt = dbMockError.build();

      dbMockErrorBuilt.select = vi.fn().mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      Object.defineProperty(service, 'db', {
        value: dbMockErrorBuilt,
        writable: true,
      });

      await service.generateSitemapFn();

      expect(loggerSpy).toHaveBeenCalledWith('生成站点地图失败！');
      expect(loggerSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(loggerSpy).toHaveBeenCalledWith('Error message: Database error');
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Error stack:'));

      loggerSpy.mockRestore();
    });
  });

  describe('getSiteUrls', () => {
    it('should return all site URLs', async () => {
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
      expect(paths).toEqual(['/page/1']);
    });
  });

  describe('generateSitemapFn - normalization & hook payload', () => {
    it('should normalize, same-origin filter, dedupe and sort urls then pass to beforeGenerate', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      (settingCoreService.getConfig as any).mockImplementation(async (key: string) => {
        if (key === 'baseUrl') return await Promise.resolve('https://example.com');
        return await Promise.resolve(null);
      });

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
      const beforeArgs = calls.find((args: any) => args[0] === 'sitemap|beforeGenerate');
      expect(beforeArgs).toBeTruthy();
      const [, payload] = beforeArgs as [string, { siteUrl: string; urls: string[] }];
      expect(payload.siteUrl).toBe('https://example.com/');
      expect(payload.urls).toEqual([...payload.urls].sort());
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

      const databaseMockBuilder = Mock.db();
      databaseMockBuilder.setQueryResult(mockArticles);
      const mockDb = databaseMockBuilder.build();

      Object.defineProperty(service, 'db', {
        value: mockDb,
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

      const databaseMockBuilder = Mock.db();
      databaseMockBuilder.setQueryResult(mockArticles);
      const mockDb = databaseMockBuilder.build();

      Object.defineProperty(service, 'db', {
        value: mockDb,
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

      const databaseMockBuilder = Mock.db();
      databaseMockBuilder.setQueryResult(mockCategories);
      const mockDb = databaseMockBuilder.build();

      Object.defineProperty(service, 'db', {
        value: mockDb,
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

      const databaseMockBuilder = Mock.db();
      databaseMockBuilder.setQueryResult(mockTags);
      const mockDb = databaseMockBuilder.build();

      Object.defineProperty(service, 'db', {
        value: mockDb,
        writable: true,
      });

      const urls = await service.getTagUrls();

      expect(urls).toContain('/tag/JavaScript');
      expect(urls).toContain('/tag/Node.js');
    });
  });

  describe('getPageUrls - pagination', () => {
    it('should generate correct number of pages', async () => {
      (settingCoreService.getConfig as any).mockResolvedValue(10);

      const databaseMockBuilder = Mock.db();
      databaseMockBuilder.setCountResult(25);
      const mockDb = databaseMockBuilder.build();

      Object.defineProperty(service, 'db', {
        value: mockDb,
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

      const databaseMockBuilder = Mock.db();
      databaseMockBuilder.setCountResult(0);
      const mockDb = databaseMockBuilder.build();

      Object.defineProperty(service, 'db', {
        value: mockDb,
        writable: true,
      });

      const urls = await service.getPageUrls();

      expect(urls).toHaveLength(0);
    });

    it('should fallback to list length when count fails', async () => {
      (settingCoreService.getConfig as any).mockResolvedValue(5);

      let selectCallCount = 0;
      const mockDb = {
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
      };

      Object.defineProperty(service, 'db', {
        value: mockDb,
        writable: true,
      });

      const urls = await service.getPageUrls();

      expect(urls).toHaveLength(1);
      expect(urls).toContain('/page/1');
    });
  });

  describe('generateSitemap - debounce', () => {
    it('should debounce sitemap generation', () => {
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

  describe('URL utilities', () => {
    it('washUrl should add trailing slash if missing', () => {
      const result = service['washUrl']('https://example.com');
      expect(result).toBe('https://example.com/');
    });

    it('washUrl should not add trailing slash if already present', () => {
      const result = service['washUrl']('https://example.com/');
      expect(result).toBe('https://example.com/');
    });

    it('washUrl should handle empty string', () => {
      const result = service['washUrl']('');
      expect(result).toBe('http://localhost:3000/');
    });

    it('dedupe should remove duplicate URLs', () => {
      const urls = ['/', '/post/1', '/', '/post/2', '/post/1'];
      const result = service['dedupe'](urls);
      expect(result).toEqual(['/', '/post/1', '/post/2']);
    });

    it('dedupe should preserve order of first occurrence', () => {
      const urls = ['/a', '/b', '/a', '/c', '/b'];
      const result = service['dedupe'](urls);
      expect(result).toEqual(['/a', '/b', '/c']);
    });

    it('normalizeUrls should normalize relative paths', () => {
      const urls = ['/post/1', 'category/tech', '//double//slashes'];
      const result = service['normalizeUrls']('https://example.com', urls);
      expect(result).toContain('/post/1');
      expect(result).toContain('/category/tech');
      expect(result).toContain('/double/slashes');
    });

    it('normalizeUrls should filter out cross-origin URLs', () => {
      const urls = ['https://example.com/post/1', 'https://other.com/post/2'];
      const result = service['normalizeUrls']('https://example.com', urls);
      expect(result).toContain('/post/1');
      expect(result).not.toContain('/post/2');
    });

    it('normalizeUrls should remove trailing slashes except for root', () => {
      const urls = ['/', '/post/1/', '/category/tech/'];
      const result = service['normalizeUrls']('https://example.com', urls);
      expect(result).toContain('/');
      expect(result).toContain('/post/1');
      expect(result).toContain('/category/tech');
    });

    it('normalizeUrls should handle empty strings', () => {
      const urls = ['', '  ', '/valid'];
      const result = service['normalizeUrls']('https://example.com', urls);
      expect(result).toContain('/valid');
      expect(result).not.toContain('');
    });

    it('normalizeUrls should handle malformed URLs gracefully', () => {
      const urls = ['ht tp://invalid', '/valid', 'just-text'];
      const result = service['normalizeUrls']('https://example.com', urls);
      expect(result).toContain('/valid');
      expect(result).toContain('/just-text');
    });
  });

  describe('priority and frequency', () => {
    it('getChangeFreq should return correct frequency for each section', () => {
      expect(service['getChangeFreq']('/')).toBe('daily');
      expect(service['getChangeFreq']('/post/test')).toBe('weekly');
      expect(service['getChangeFreq']('/category/tech')).toBe('weekly');
      expect(service['getChangeFreq']('/tag/javascript')).toBe('weekly');
      expect(service['getChangeFreq']('/page/1')).toBe('daily');
      expect(service['getChangeFreq']('/about')).toBe('monthly');
    });

    it('getPriority should return correct priority for each section', () => {
      expect(service['getPriority']('/')).toBe(1.0);
      expect(service['getPriority']('/post/test')).toBe(0.8);
      expect(service['getPriority']('/category/tech')).toBe(0.6);
      expect(service['getPriority']('/tag/javascript')).toBe(0.6);
      expect(service['getPriority']('/page/1')).toBe(0.5);
      expect(service['getPriority']('/about')).toBe(0.4);
    });
  });

  describe('hook integration', () => {
    it('should apply sitemap|collect_urls filter', async () => {
      const extraUrls = ['/custom-1', '/custom-2'];
      (hookService.applyFilters as any).mockImplementation((_hook: string, urls: string[]) => {
        return Promise.resolve([...urls, ...extraUrls]);
      });

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
