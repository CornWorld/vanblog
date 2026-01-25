import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { Mock } from '@test/mock';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { db } from '@test/setup.unit';
import { Given } from '@test/given';
import { generateTestId } from '@test/test-utils';
import { articles, categories } from '@vanblog/shared/drizzle';

import { DATABASE_CONNECTION } from '../../database';
import { MarkdownService } from '../../shared/services/markdown.service';
import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

import { RssService } from './rss.service';

// Mock fs module - must be before importing fs
vi.mock('fs/promises');

// Now import fs after the mock is set up
import * as fs from 'fs/promises';

// Helper function to create a test category
const createTestCategory = async (tx: any, categoryName: string) => {
  await Given.category(tx, { name: categoryName });
};

// Helper function to create a test article
const createTestArticle = async (tx: any, overrides: any = {}) => {
  // Generate unique pathname using test ID generator
  const uniqueId = generateTestId();
  const uniqueSuffix = String(uniqueId) + Math.random().toString(36).substring(7);

  return await tx
    .insert(articles)
    .values({
      title: 'Test Article',
      content: 'Test content',
      pathname: `test-article-${uniqueSuffix}`,
      author: 'admin',
      hidden: 0,
      private: 0,
      top: 0,
      category: null, // Avoid FK constraint
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    })
    .returning();
};

describe('RssService', () => {
  let service: RssService;
  let module: TestingModule;
  let settingCoreService: any;
  let hookService: any;
  let markdownService: any;
  let configService: any;

  const mockSiteInfo = {
    title: 'Test Blog',
    description: 'A test blog for unit testing',
    author: 'Test Author',
    keywords: ['test', 'blog'],
  };

  beforeEach(async () => {
    // Setup service mocks
    settingCoreService = {
      getConfig: vi.fn().mockImplementation((key: string, defaultValue?: any) => {
        const configs: Record<string, any> = {
          showRSS: true,
          baseUrl: 'https://test-blog.com',
          siteInfo: mockSiteInfo,
          waline: null,
          authorEmail: 'test@example.com',
          favicon: '',
          siteLogo: 'https://test-blog.com/logo.png',
          authorLogo: '',
        };
        return Promise.resolve(configs[key] ?? defaultValue);
      }),
    };

    hookService = Mock.hook();
    markdownService = {
      renderForRss: vi.fn().mockImplementation((content: string) => `<p>${content}</p>`),
      getDescription: vi.fn().mockImplementation((content: string) => content.substring(0, 100)),
    };

    configService = Mock.config({
      'static.path': './test-static',
      STATIC_PATH: './test-static',
    });

    module = await Test.createTestingModule({
      providers: [
        RssService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: MarkdownService,
          useValue: markdownService,
        },
        {
          provide: HookService,
          useValue: hookService,
        },
        {
          provide: SettingCoreService,
          useValue: settingCoreService,
        },
      ],
    }).compile();

    service = module.get<RssService>(RssService);

    // Mock fs operations - ensure they're properly set up
    vi.mocked(fs.access).mockImplementation(() => {
      return Promise.reject(new Error('Directory does not exist'));
    });
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({
      mtime: new Date('2024-01-15T12:00:00Z'),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset fs mock implementations to prevent interference between tests
    vi.mocked(fs.writeFile).mockReset();
    vi.mocked(fs.mkdir).mockReset();
    vi.mocked(fs.access).mockReset();
    vi.mocked(fs.stat).mockReset();

    // Restore default implementations after reset
    vi.mocked(fs.access).mockImplementation(() => {
      return Promise.reject(new Error('Directory does not exist'));
    });
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({
      mtime: new Date('2024-01-15T12:00:00Z'),
    } as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRssFeedFn', () => {
    it('should generate RSS feed successfully with all formats', async () => {
      await withTestTransaction(db, async (tx) => {
        // Inject test database
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks before test
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockResolvedValue(undefined); // Changed: directory exists
        vi.mocked(fs.stat).mockResolvedValue({
          mtime: new Date('2024-01-15T12:00:00Z'),
        } as any);

        // Create test categories first (foreign key requirement)
        await createTestCategory(tx, 'Tech');
        await createTestCategory(tx, 'Design');

        // Verify categories were created
        const allCategories = await tx.select().from(categories);
        expect(allCategories.length).toBe(2);

        // Create test articles
        const [article1] = await tx
          .insert(articles)
          .values({
            title: 'Test Article 1',
            content: '# Test Content 1\n\nThis is a test article.',
            pathname: 'test-article-1',
            category: 'Tech',
            author: 'admin',
            hidden: 0,
            private: 0,
            top: 0,
            createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
            updatedAt: new Date('2024-01-02T00:00:00Z').toISOString(),
          } as any)
          .returning();

        const [article2] = await tx
          .insert(articles)
          .values({
            title: 'Test Article 2',
            content: '# Test Content 2\n\nAnother test article.',
            pathname: 'test-article-2',
            category: 'Design',
            author: 'admin',
            hidden: 0,
            private: 0,
            top: 0,
            createdAt: new Date('2024-01-05T00:00:00Z').toISOString(),
            updatedAt: new Date('2024-01-06T00:00:00Z').toISOString(),
          } as any)
          .returning();

        // Verify articles were created
        const allArticles = await tx.select().from(articles);
        expect(allArticles.length).toBe(2);

        await service.generateRssFeedFn('Test generation');

        // Verify markdown rendering was called for each article
        expect(markdownService.renderForRss).toHaveBeenCalled();
        expect(markdownService.getDescription).toHaveBeenCalled();

        // Verify hooks were called
        expect(hookService.doAction).toHaveBeenCalledWith(
          'rss|beforeGenerate',
          expect.objectContaining({
            feed: expect.any(Object),
            articles: expect.arrayContaining([
              expect.objectContaining({ id: article1.id }),
              expect.objectContaining({ id: article2.id }),
            ]),
            siteInfo: expect.any(Object),
          }),
        );

        expect(hookService.doAction).toHaveBeenCalledWith(
          'rss|afterGenerate',
          expect.objectContaining({
            rssPath: expect.stringContaining('rss'),
            files: ['feed.json', 'feed.xml', 'atom.xml'],
          }),
        );

        // Verify all three feed formats were written
        expect(fs.writeFile).toHaveBeenCalledTimes(3);
        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('feed.json'),
          expect.any(String),
        );
        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('feed.xml'),
          expect.any(String),
        );
        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('atom.xml'),
          expect.any(String),
        );
      });
    });

    it('should skip RSS generation when showRSS is false', async () => {
      settingCoreService.getConfig.mockImplementation((key: string) => {
        if (key === 'showRSS') return Promise.resolve(false);
        return Promise.resolve(null);
      });

      const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

      await service.generateRssFeedFn();

      expect(logSpy).toHaveBeenCalledWith('RSS 功能已关闭，跳过生成');
      expect(fs.writeFile).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should handle private articles correctly', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        // Create test articles - only public articles should be in RSS
        await tx
          .insert(articles)
          .values({
            title: 'Public Article',
            content: 'Public content',
            pathname: 'public-article',
            author: 'admin',
            hidden: 0,
            private: 0,
            top: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any)
          .returning();

        // Private article should NOT be included in RSS (service filters it out)
        await tx
          .insert(articles)
          .values({
            title: 'Private Article',
            content: 'Secret content',
            pathname: 'private-article',
            author: 'admin',
            hidden: 0,
            private: 1, // Private - will be filtered out by WHERE clause
            top: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any)
          .returning();

        await service.generateRssFeedFn();

        // Verify that renderForRss was NOT called with encrypted message
        // because private articles are filtered out at the database level
        expect(markdownService.renderForRss).toHaveBeenCalledWith('Public content');
        expect(markdownService.renderForRss).not.toHaveBeenCalledWith('此文章已加密');
      });
    });

    it('should create RSS directory if it does not exist', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        await service.generateRssFeedFn();

        expect(fs.access).toHaveBeenCalled();
        expect(fs.mkdir).toHaveBeenCalledWith(
          expect.stringContaining('rss'),
          expect.objectContaining({ recursive: true }),
        );
      });
    });

    it('should handle existing RSS directory', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockResolvedValue(undefined);

        await service.generateRssFeedFn();

        expect(fs.access).toHaveBeenCalled();
        expect(fs.mkdir).not.toHaveBeenCalled();
      });
    });

    it('should use correct site configuration', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });
        await service.generateRssFeedFn();

        // Verify all config reads were made
        expect(settingCoreService.getConfig).toHaveBeenCalledWith('baseUrl', expect.any(String));
        expect(settingCoreService.getConfig).toHaveBeenCalledWith('siteInfo');
        expect(settingCoreService.getConfig).toHaveBeenCalledWith('waline');
        expect(settingCoreService.getConfig).toHaveBeenCalledWith('authorEmail');
        expect(settingCoreService.getConfig).toHaveBeenCalledWith('favicon', '');
        expect(settingCoreService.getConfig).toHaveBeenCalledWith('siteLogo', '');
        expect(settingCoreService.getConfig).toHaveBeenCalledWith('authorLogo', '');
      });
    });

    it('should handle waline config for author email', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });
        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'waline') {
            return Promise.resolve({ authorEmail: 'waline@example.com' });
          }
          if (key === 'authorEmail') return Promise.resolve('');
          const configs: Record<string, any> = {
            showRSS: true,
            baseUrl: 'https://test-blog.com',
            siteInfo: mockSiteInfo,
            favicon: '',
            siteLogo: '',
            authorLogo: '',
          };
          return Promise.resolve(configs[key] ?? defaultValue);
        });

        await service.generateRssFeedFn();

        expect(settingCoreService.getConfig).toHaveBeenCalledWith('waline');
      });
    });

    it('should handle database errors gracefully', async () => {
      // Reset fs mocks first
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

      // Mock the service db to throw error
      const errorDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockRejectedValue(new Error('Database connection failed')),
            }),
          }),
        }),
      };

      Object.defineProperty(service, 'db', {
        value: errorDb,
        writable: true,
      });

      const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      await service.generateRssFeedFn();

      expect(logSpy).toHaveBeenCalledWith('生成订阅源失败！');
      expect(logSpy).toHaveBeenCalledTimes(2); // Called twice: failure message + error details

      logSpy.mockRestore();
    });

    it('should handle file system errors gracefully', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks and make writeFile fail
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write permission denied'));
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

        await service.generateRssFeedFn();

        expect(logSpy).toHaveBeenCalledWith('生成订阅源失败！');

        logSpy.mockRestore();
      });
    });

    it('should handle hook errors gracefully', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });
        hookService.doAction.mockRejectedValue(new Error('Hook failed'));

        const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

        await service.generateRssFeedFn();

        // Should log error but continue
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error in rss|beforeGenerate hook'),
          expect.any(Error),
        );

        logSpy.mockRestore();
      });
    });

    it('should use correct URLs for articles', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        await createTestArticle(tx, {
          title: 'Test Article',
          pathname: 'test-article-1',
        });

        await service.generateRssFeedFn();

        // RSS should contain correct article URLs
        expect(fs.writeFile).toHaveBeenCalled();
        const feedXmlCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.xml');
        });
        expect(feedXmlCall).toBeDefined();
        const feedXml = feedXmlCall?.[1] as string;
        expect(feedXml).toContain('https://test-blog.com/post/test-article-1');
      });
    });

    it('should format JSON feed dates correctly', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        await createTestArticle(tx, {
          title: 'Test Article',
          pathname: 'test-article',
          createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
          updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
        });

        await service.generateRssFeedFn();

        const feedJsonCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.json');
        });
        expect(feedJsonCall).toBeDefined();

        const feedJson = feedJsonCall?.[1] as string;
        const jsonData = JSON.parse(feedJson);

        // Check that dates are formatted strings
        expect(jsonData.items).toBeDefined();
        expect(Array.isArray(jsonData.items)).toBe(true);
      });
    });

    it('should handle empty article list', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        // Don't create any articles - database is empty
        await service.generateRssFeedFn();

        // Should still generate feeds, just empty
        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });

    it('should use default values for missing site info', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'siteInfo') return Promise.resolve(null);
          if (key === 'showRSS') return Promise.resolve(true);
          return Promise.resolve(defaultValue);
        });

        await service.generateRssFeedFn();

        // Should use default values and not crash
        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });

    it('should add log message with info parameter', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });
        const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

        await service.generateRssFeedFn('Custom trigger info');

        expect(logSpy).toHaveBeenCalledWith('Custom trigger info重新生成 RSS 订阅');

        logSpy.mockRestore();
      });
    });

    it('should log success message on completion', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });
        const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

        await service.generateRssFeedFn();

        expect(logSpy).toHaveBeenCalledWith('RSS 订阅生成完成');

        logSpy.mockRestore();
      });
    });
  });

  describe('generateRssFeed (debounced)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce multiple calls with default delay', async () => {
      const generateSpy = vi.spyOn(service, 'generateRssFeedFn').mockResolvedValue();

      service.generateRssFeed('test1');
      service.generateRssFeed('test2');
      service.generateRssFeed('test3');

      // Should not be called immediately
      expect(generateSpy).not.toHaveBeenCalled();

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

      // Should be called only once with the last info
      expect(generateSpy).toHaveBeenCalledTimes(1);
      expect(generateSpy).toHaveBeenCalledWith('test3');

      generateSpy.mockRestore();
    });

    it('should debounce with custom delay', async () => {
      const generateSpy = vi.spyOn(service, 'generateRssFeedFn').mockResolvedValue();

      service.generateRssFeed('test1', 1000);
      service.generateRssFeed('test2', 1000);

      await vi.advanceTimersByTimeAsync(500);
      expect(generateSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(600);
      expect(generateSpy).toHaveBeenCalledTimes(1);

      generateSpy.mockRestore();
    });

    it('should clear previous timer on new call', async () => {
      const generateSpy = vi.spyOn(service, 'generateRssFeedFn').mockResolvedValue();

      service.generateRssFeed('test1', 1000);
      await vi.advanceTimersByTimeAsync(500);

      service.generateRssFeed('test2', 1000);
      await vi.advanceTimersByTimeAsync(500);

      // First call should be cancelled
      expect(generateSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(600);
      expect(generateSpy).toHaveBeenCalledTimes(1);
      expect(generateSpy).toHaveBeenCalledWith('test2');

      generateSpy.mockRestore();
    });
  });

  describe('washUrl', () => {
    it('should add trailing slash if missing', () => {
      const result = (service as any).washUrl('https://example.com');
      expect(result).toBe('https://example.com/');
    });

    it('should not add trailing slash if already present', () => {
      const result = (service as any).washUrl('https://example.com/');
      expect(result).toBe('https://example.com/');
    });

    it('should return default URL for empty string', () => {
      const result = (service as any).washUrl('');
      expect(result).toBe('http://localhost:3000/');
    });
  });

  describe('Feed content validation', () => {
    beforeEach(() => {
      // Reset fs mocks before each test in this section
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));
    });

    it('should include all required feed metadata', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        await service.generateRssFeedFn();

        const feedXmlCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.xml');
        });
        expect(feedXmlCall).toBeDefined();

        const feedXml = feedXmlCall?.[1] as string;
        expect(feedXml).toBeDefined();

        // Check feed metadata
        expect(feedXml).toContain('Test Blog');
        expect(feedXml).toContain('A test blog for unit testing');
        expect(feedXml).toContain('Test Author');
      });
    });

    it('should include article categories in feed', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        // Create test categories first (foreign key requirement)
        await createTestCategory(tx, 'Tech');
        await createTestCategory(tx, 'Design');

        // Verify categories were created
        const cats = await tx.select().from(categories);
        expect(cats.length).toBe(2);

        // Create test articles with categories
        await createTestArticle(tx, {
          title: 'Tech Article',
          category: 'Tech',
        });

        await createTestArticle(tx, {
          title: 'Design Article',
          category: 'Design',
        });

        await service.generateRssFeedFn();

        const feedXmlCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.xml');
        });
        const feedXml = feedXmlCall?.[1] as string;

        expect(feedXml).toContain('Tech');
        expect(feedXml).toContain('Design');
      });
    });

    it('should include proper feed links', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        await service.generateRssFeedFn();

        const feedJsonCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.json');
        });
        expect(feedJsonCall).toBeDefined();

        const feedJson = JSON.parse(feedJsonCall?.[1] as string);

        expect(feedJson.feed_url).toBeDefined();
        expect(feedJson.home_page_url).toBe('https://test-blog.com/');
      });
    });
  });

  describe('JSON Feed schema validation', () => {
    it('should handle JSON Feed schema validation failure', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        const logSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

        // Mock JSON.parse to return invalid data that will fail schema validation
        const originalParse = JSON.parse;
        let parseCallCount = 0;
        vi.spyOn(JSON, 'parse').mockImplementation((text: string) => {
          parseCallCount++;
          // Only intercept the first call (the feed.json1() parsing, not test assertions)
          if (parseCallCount === 1 && text.includes('"version"')) {
            // Return data with invalid items (items should be an array, but we give an object)
            return {
              version: 'https://jsonfeed.org/version/1',
              items: 'not-an-array', // This will cause validation to fail
            };
          }
          return originalParse(text);
        });

        await service.generateRssFeedFn();

        // Verify warning was logged
        expect(logSpy).toHaveBeenCalledWith(
          'RSS JSON Feed schema validation failed, writing original JSON',
        );

        // Verify feed was still written
        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('feed.json'),
          expect.any(String),
        );

        logSpy.mockRestore();
        vi.mocked(JSON.parse).mockRestore();
      });
    });

    it('should handle JSON Feed post-process exception', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

        // Mock JSON.parse to throw an error
        const originalParse = JSON.parse;
        let callCount = 0;
        vi.spyOn(JSON, 'parse').mockImplementation((text: string) => {
          callCount++;
          // Only throw on the first call within the try block (not test code)
          if (callCount === 1 && text.includes('"version"')) {
            throw new Error('JSON parse failed');
          }
          return originalParse(text);
        });

        await service.generateRssFeedFn();

        // Verify error was logged
        expect(logSpy).toHaveBeenCalledWith('RSS JSON Feed post-process failed');

        logSpy.mockRestore();
        vi.mocked(JSON.parse).mockRestore();
      });
    });

    it('should successfully validate and format valid JSON Feed dates', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        await service.generateRssFeedFn();

        const feedJsonCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.json');
        });
        expect(feedJsonCall).toBeDefined();

        const feedJson = JSON.parse(feedJsonCall?.[1] as string);

        // Verify dates are properly formatted (ISO 8601)
        // date_modified is optional but if present should be formatted correctly
        if (feedJson.date_modified) {
          expect(feedJson.date_modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        }
        if (feedJson.items && feedJson.items.length > 0) {
          feedJson.items.forEach((item: any) => {
            if (item.date_published) {
              expect(item.date_published).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            }
            if (item.date_modified) {
              expect(item.date_modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            }
          });
        }
      });
    });
  });

  describe('Logo and favicon selection logic', () => {
    beforeEach(() => {
      // Reset fs mocks before each test in this section
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));
    });

    it('should prioritize favicon over other logos for favicon field', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          const configs: Record<string, any> = {
            showRSS: true,
            baseUrl: 'https://test-blog.com',
            siteInfo: mockSiteInfo,
            waline: null,
            authorEmail: 'test@example.com',
            favicon: 'https://test-blog.com/favicon.png',
            siteLogo: 'https://test-blog.com/site-logo.png',
            authorLogo: 'https://test-blog.com/author-logo.png',
          };
          return Promise.resolve(configs[key] ?? defaultValue);
        });

        await service.generateRssFeedFn();

        // Verify feed generation
        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });

    it('should use siteLogo as favicon fallback when favicon is empty', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          const configs: Record<string, any> = {
            showRSS: true,
            baseUrl: 'https://test-blog.com',
            siteInfo: mockSiteInfo,
            waline: null,
            authorEmail: 'test@example.com',
            favicon: '',
            siteLogo: 'https://test-blog.com/site-logo.png',
            authorLogo: 'https://test-blog.com/author-logo.png',
          };
          return Promise.resolve(configs[key] ?? defaultValue);
        });

        await service.generateRssFeedFn();

        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });

    it('should use authorLogo as favicon fallback when favicon and siteLogo are empty', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          const configs: Record<string, any> = {
            showRSS: true,
            baseUrl: 'https://test-blog.com',
            siteInfo: mockSiteInfo,
            waline: null,
            authorEmail: 'test@example.com',
            favicon: '',
            siteLogo: '',
            authorLogo: 'https://test-blog.com/author-logo.png',
          };
          return Promise.resolve(configs[key] ?? defaultValue);
        });

        await service.generateRssFeedFn();

        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });

    it('should use default logo.svg when all logo fields are empty', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          const configs: Record<string, any> = {
            showRSS: true,
            baseUrl: 'https://test-blog.com',
            siteInfo: mockSiteInfo,
            waline: null,
            authorEmail: 'test@example.com',
            favicon: '',
            siteLogo: '',
            authorLogo: '',
          };
          return Promise.resolve(configs[key] ?? defaultValue);
        });

        await service.generateRssFeedFn();

        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });

    it('should prioritize siteLogo for image field', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          const configs: Record<string, any> = {
            showRSS: true,
            baseUrl: 'https://test-blog.com',
            siteInfo: mockSiteInfo,
            waline: null,
            authorEmail: 'test@example.com',
            favicon: 'https://test-blog.com/favicon.png',
            siteLogo: 'https://test-blog.com/site-logo.png',
            authorLogo: 'https://test-blog.com/author-logo.png',
          };
          return Promise.resolve(configs[key] ?? defaultValue);
        });

        await service.generateRssFeedFn();

        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });

    it('should use authorLogo for image field when siteLogo is empty', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          const configs: Record<string, any> = {
            showRSS: true,
            baseUrl: 'https://test-blog.com',
            siteInfo: mockSiteInfo,
            waline: null,
            authorEmail: 'test@example.com',
            favicon: 'https://test-blog.com/favicon.png',
            siteLogo: '',
            authorLogo: 'https://test-blog.com/author-logo.png',
          };
          return Promise.resolve(configs[key] ?? defaultValue);
        });

        await service.generateRssFeedFn();

        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });

    it('should use favicon for image field when siteLogo and authorLogo are empty', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          const configs: Record<string, any> = {
            showRSS: true,
            baseUrl: 'https://test-blog.com',
            siteInfo: mockSiteInfo,
            waline: null,
            authorEmail: 'test@example.com',
            favicon: 'https://test-blog.com/favicon.png',
            siteLogo: '',
            authorLogo: '',
          };
          return Promise.resolve(configs[key] ?? defaultValue);
        });

        await service.generateRssFeedFn();

        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Email configuration edge cases', () => {
    it('should use process.env.EMAIL when available', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        const originalEmail = process.env.EMAIL;
        process.env.EMAIL = 'env@example.com';

        await service.generateRssFeedFn();

        expect(fs.writeFile).toHaveBeenCalledTimes(3);

        // Restore original
        if (originalEmail === undefined) {
          delete process.env.EMAIL;
        } else {
          process.env.EMAIL = originalEmail;
        }
      });
    });

    it('should use waline authorEmail when main authorEmail is empty string', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          const configs: Record<string, any> = {
            showRSS: true,
            baseUrl: 'https://test-blog.com',
            siteInfo: mockSiteInfo,
            waline: { authorEmail: 'waline@example.com' },
            authorEmail: '',
            favicon: '',
            siteLogo: '',
            authorLogo: '',
          };
          return Promise.resolve(configs[key] ?? defaultValue);
        });

        await service.generateRssFeedFn();

        expect(settingCoreService.getConfig).toHaveBeenCalledWith('waline');
        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });

    it('should not use waline authorEmail when main authorEmail has value', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        settingCoreService.getConfig.mockImplementation((key: string, defaultValue?: any) => {
          const configs: Record<string, any> = {
            showRSS: true,
            baseUrl: 'https://test-blog.com',
            siteInfo: mockSiteInfo,
            waline: { authorEmail: 'waline@example.com' },
            authorEmail: 'main@example.com',
            favicon: '',
            siteLogo: '',
            authorLogo: '',
          };
          return Promise.resolve(configs[key] ?? defaultValue);
        });

        await service.generateRssFeedFn();

        expect(fs.writeFile).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Feed format generation', () => {
    it('should generate valid RSS 2.0 XML format', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        await service.generateRssFeedFn();

        const feedXmlCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.xml');
        });
        expect(feedXmlCall).toBeDefined();

        const feedXml = feedXmlCall?.[1] as string;

        // Check RSS 2.0 structure
        expect(feedXml).toContain('<?xml version=');
        expect(feedXml).toContain('<rss');
        expect(feedXml).toContain('</rss>');
        expect(feedXml).toContain('<channel>');
        expect(feedXml).toContain('</channel>');
      });
    });

    it('should generate valid Atom 1.0 XML format', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        // Create a test article first
        await createTestArticle(tx, {
          title: 'Test Article',
          pathname: 'test-article',
        });

        await service.generateRssFeedFn();

        const atomXmlCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('atom.xml');
        });
        expect(atomXmlCall).toBeDefined();

        const atomXml = atomXmlCall?.[1] as string;

        // Check Atom 1.0 structure
        expect(atomXml).toContain('<?xml version=');
        expect(atomXml).toContain('<feed');
        expect(atomXml).toContain('xmlns="http://www.w3.org/2005/Atom"');
        expect(atomXml).toContain('</feed>');
      });
    });

    it('should generate valid JSON Feed format', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        // Create a test article first
        await createTestArticle(tx, {
          title: 'Test Article',
          pathname: 'test-article',
        });

        await service.generateRssFeedFn();

        const feedJsonCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.json');
        });
        expect(feedJsonCall).toBeDefined();

        const feedJsonStr = feedJsonCall?.[1] as string;
        const feedJson = JSON.parse(feedJsonStr);

        // Check JSON Feed structure
        expect(feedJson.version).toBe('https://jsonfeed.org/version/1');
        expect(feedJson.title).toBeDefined();
        expect(feedJson.home_page_url).toBeDefined();
        expect(feedJson.items).toBeDefined();
        expect(Array.isArray(feedJson.items)).toBe(true);
      });
    });
  });

  describe('Article content rendering', () => {
    beforeEach(() => {
      // Reset fs mocks before each test in this section
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));
    });

    it('should render markdown content for all articles including private', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        // Create test articles including a private one
        await createTestArticle(tx, {
          title: 'Public Article',
          content: 'Public content',
          pathname: 'public-article',
        });

        // Private articles are filtered at DB level and won't be in RSS
        await createTestArticle(tx, {
          title: 'Private Article',
          content: 'Secret content',
          pathname: 'private-article',
          private: 1, // Will be filtered out
        });

        await service.generateRssFeedFn();

        expect(markdownService.renderForRss).toHaveBeenCalled();
        expect(markdownService.getDescription).toHaveBeenCalled();

        // renderForRss is called twice per article: once for content, once for description
        expect(markdownService.renderForRss).toHaveBeenCalledTimes(2);
      });
    });

    it('should include stylesheet links in RSS HTML content', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        await createTestArticle(tx, {
          title: 'Test Article',
          content: 'Test content',
          pathname: 'test-article',
        });

        await service.generateRssFeedFn();

        const feedXmlCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.xml');
        });
        const feedXml = feedXmlCall?.[1] as string;
        expect(feedXml).toBeDefined();

        // Check for stylesheet links
        expect(feedXml).toContain('markdown.css');
        expect(feedXml).toContain('katex.min.css');
        expect(feedXml).toContain('highlight');
      });
    });

    it('should generate proper article URLs with pathname', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        await createTestArticle(tx, {
          title: 'Test Article 1',
          content: 'Test content',
          pathname: 'test-article-1',
        });

        await createTestArticle(tx, {
          title: 'Test Article 2',
          content: 'Test content',
          pathname: 'test-article-2',
        });

        await service.generateRssFeedFn();

        const feedXmlCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.xml');
        });
        const feedXml = feedXmlCall?.[1] as string;
        expect(feedXml).toBeDefined();

        // Verify article URLs use pathname
        expect(feedXml).toContain('https://test-blog.com/post/test-article-1');
        expect(feedXml).toContain('https://test-blog.com/post/test-article-2');
      });
    });

    it('should handle articles with tags', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Reset fs mocks to ensure they're called
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

        await createTestArticle(tx, {
          title: 'Test Article',
          content: 'Test content',
          tags: 'javascript,typescript',
          pathname: 'test-article',
        });

        await service.generateRssFeedFn();

        const feedJsonCall = vi.mocked(fs.writeFile).mock.calls.find((call) => {
          const path = call[0] as string;
          return path.includes('feed.json');
        });
        expect(feedJsonCall).toBeDefined();

        // 添加防御检查
        if (!feedJsonCall || !feedJsonCall[1]) {
          throw new Error('feed.json was not written');
        }

        const feedJson = JSON.parse(feedJsonCall[1] as string);

        // Tags are included in the feed items
        expect(feedJson.items).toBeDefined();
        expect(feedJson.items.length).toBeGreaterThan(0);
      });
    });

    it('should render private article with encrypted message', async () => {
      await withTestTransaction(db, async (tx) => {
        Object.defineProperty(service, 'db', { value: tx, writable: true, configurable: true });

        // Create a private article - it will be filtered at DB level
        await createTestArticle(tx, {
          title: 'Private Article',
          content: 'Secret content',
          pathname: 'private-article',
          private: 1,
        });

        await service.generateRssFeedFn();

        // Private articles are filtered out at DB level, so renderForRss
        // should NOT be called with '此文章已加密'
        expect(markdownService.renderForRss).not.toHaveBeenCalledWith('此文章已加密');
      });
    });
  });
});
