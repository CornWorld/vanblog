import * as fs from 'fs/promises';
import * as path from 'path';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
// import { Feed } from 'feed';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';
import { MarkdownService } from '../../shared/services/markdown.service';
import { ArticleService } from '../article/article.service';
import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

import { RssService } from './rss.service';

// Mock fs module
vi.mock('fs/promises');
vi.mock('path');

describe('RssService', () => {
  let service: RssService;
  let articleService: any;
  let settingCoreService: any;

  let configService: any;

  const mockArticles = [
    {
      id: 1,
      title: 'Test Article 1',
      content: '# Test Content 1',
      pathname: 'test-article-1',
      author: 'Test Author',
      category: 'Test Category',
      tags: ['tag1', 'tag2'],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      published: true,
      top: false,
      hidden: false,
      password: null,
      copyrightNotice: null,
      allowComment: true,
      views: 100,
    },
    {
      id: 2,
      title: 'Test Article 2',
      content: '# Test Content 2',
      pathname: 'test-article-2',
      author: 'Test Author',
      category: 'Test Category',
      tags: ['tag3'],
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      published: true,
      top: false,
      hidden: false,
      password: null,
      copyrightNotice: null,
      allowComment: true,
      views: 50,
    },
  ];

  const mockSiteInfo = {
    title: 'Test Blog',
    description: 'Test Blog Description',
    author: 'Test Author',
    keywords: ['test'],
  };

  const mockConfig = {
    showRSS: true,
  };

  beforeEach(async () => {
    const mockArticleService = {
      findAll: vi.fn(),
    };

    const mockSettingCoreService = {
      getSiteInfo: vi.fn(),
      getConfig: vi.fn(),
    };

    const mockHookService = {
      doAction: vi.fn(),
    };

    const mockMarkdownService = {
      renderForRss: vi.fn().mockImplementation((content: string) => `<p>${content}</p>`),
      getDescription: vi.fn().mockImplementation((content: string) => content.substring(0, 100)),
    };

    const mockConfigService = {
      get: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RssService,
        {
          provide: ArticleService,
          useValue: mockArticleService,
        },
        {
          provide: SettingCoreService,
          useValue: mockSettingCoreService,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
        {
          provide: MarkdownService,
          useValue: mockMarkdownService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<RssService>(RssService);
    articleService = module.get(ArticleService);
    settingCoreService = module.get(SettingCoreService);
    // hookService = module.get(HookService);
    configService = module.get(ConfigService);

    // Setup default mocks
    articleService.findAll.mockResolvedValue({
      data: mockArticles,
      total: mockArticles.length,
      page: 1,
      pageSize: 10,
    });

    settingCoreService.getSiteInfo.mockResolvedValue(mockSiteInfo);
    settingCoreService.getConfig.mockResolvedValue(mockConfig);
    configService.get.mockReturnValue('/tmp/static');

    // Mock fs operations
    vi.mocked(fs.access).mockRejectedValue(new Error('no access'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRssFeedFn', () => {
    it('should generate RSS feed successfully', async () => {
      // Mock database select chain
      const mockArticleSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(
              mockArticles.map((article) => ({
                ...article,
                tags: JSON.stringify(article.tags),
                createdAt: dayjs(article.createdAt as any).format(),
                updatedAt: dayjs(article.updatedAt as any).format(),
              })),
            ),
          }),
        }),
      };

      const mockMetaSelect = {
        from: vi.fn().mockResolvedValue([]),
      };

      const mockSettingSelect = {
        from: vi.fn().mockResolvedValue([]),
      };

      Object.defineProperty(service, 'db', {
        value: {
          select: vi
            .fn()
            .mockReturnValueOnce(mockArticleSelect)
            .mockReturnValueOnce(mockMetaSelect)
            .mockReturnValueOnce(mockSettingSelect),
        },
        writable: true,
      });

      await service.generateRssFeedFn();

      expect(service['db'].select).toHaveBeenCalled();
    });

    it('should skip RSS generation when showRSS is false', async () => {
      settingCoreService.getConfig.mockResolvedValue(false);

      await service.generateRssFeedFn();

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      // Mock database error
      Object.defineProperty(service, 'db', {
        value: {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockRejectedValue(new Error('Database error')),
              }),
            }),
          }),
        },
        writable: true,
      });

      await service.generateRssFeedFn();

      expect(loggerSpy).toHaveBeenCalledWith('生成订阅源失败！');
    });
  });

  describe('generateRssFeed', () => {
    it('should debounce multiple calls', async () => {
      const generateSpy = vi.spyOn(service, 'generateRssFeedFn').mockResolvedValue();

      // Call multiple times quickly with short delay
      service.generateRssFeed('test1', 100);
      service.generateRssFeed('test2', 100);
      service.generateRssFeed('test3', 100);

      // Wait for debounce delay
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(generateSpy).toHaveBeenCalledTimes(1);
    });
  });
});
