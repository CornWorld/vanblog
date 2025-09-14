import * as fs from 'fs/promises';
import * as path from 'path';

import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';
import { articles, categories, tags } from '../../database/schema';
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
      ];
      vi.spyOn(service, 'getSiteUrls').mockResolvedValue(rawUrls);

      await service.generateSitemapFn('test');

      const expected = ['/', '/a', '/b', '/page/2', '/post/abc', '/post/no-leading-slash'];

      expect(hookService.doAction).toHaveBeenCalledWith(
        'sitemap|beforeGenerate',
        expect.objectContaining({
          urls: expected,
          siteUrl: 'https://example.com/',
        }),
      );
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
  });
});
