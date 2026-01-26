import { dayjs } from '@vanblog/shared';
import { Test, type TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

import { BootstrapService } from './bootstrap.service';
import { MetaController } from './meta.controller';

// Import the new Mock utilities
import { Mock } from '../../../test/mock';

describe('MetaController', () => {
  let controller: MetaController;
  let bootstrapService: BootstrapService;
  let hookService: HookService;
  let settingCoreService: SettingCoreService;

  // Test constants
  const TEST_VERSION = '1.0.0';
  const TEST_DATE = '2024-01-01T00:00:00.000Z';
  const TEST_ABOUT_CONTENT = 'about content';

  // Mock data templates
  const mockBootstrapData = {
    version: TEST_VERSION,
    tags: ['technology', 'web', 'javascript'],
    totalArticles: 5,
    totalWordCount: 2547,
    siteInfo: {
      title: 'My Tech Blog',
      description: 'A blog about web development and technology',
      author: 'John Doe',
      keywords: ['tech', 'blog', 'web development'],
    },
    friendLinks: [
      {
        name: 'Tech News',
        description: 'Latest technology news',
        avatar: 'https://example.com/logo.png',
        url: 'https://technews.com',
      },
      {
        name: 'Dev Community',
        description: 'Developer community platform',
        avatar: 'https://example.com/dev-logo.png',
        url: 'https://dev.community',
      },
    ],
    categories: ['Web Development', 'JavaScript', 'TypeScript', 'React'],
    navigation: [
      {
        name: 'Home',
        path: '/',
        icon: 'home',
        external: false,
        children: [
          {
            name: 'Articles',
            path: '/articles',
            children: [
              {
                name: 'Web Development',
                path: '/articles/web-dev',
              },
              {
                name: 'JavaScript',
                path: '/articles/javascript',
              },
            ],
          },
          {
            name: 'About',
            path: '/about',
          },
        ],
      },
      {
        name: 'Resources',
        path: '/resources',
      },
    ],
    extensions: {
      rewards: [
        {
          name: 'Buy Me a Coffee',
          url: 'https://buymeacoffee.com/example',
        },
        {
          name: 'GitHub Sponsors',
          url: 'https://github.com/sponsors/example',
        },
      ],
      analytics: {
        enabled: true,
        provider: 'custom',
      },
    },
    walineConfig: {
      serverURL: 'https://comments.example.com',
    },
  };

  const mockAboutInfo = {
    content: TEST_ABOUT_CONTENT,
    updatedAt: TEST_DATE,
  };

  // Create mocks at describe scope so tests can access them
  let mockBootstrapService: any;
  let mockHookService: any;
  let mockSettingCoreService: any;

  beforeEach(async () => {
    // Create mocks manually since bootstrapService method doesn't exist
    mockBootstrapService = {
      getPublicBootstrap: vi.fn(),
    };
    mockHookService = Mock.hook();
    mockSettingCoreService = Mock.settingCore();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetaController],
      providers: [
        { provide: BootstrapService, useValue: mockBootstrapService },
        { provide: HookService, useValue: mockHookService },
        { provide: SettingCoreService, useValue: mockSettingCoreService },
      ],
    }).compile();

    controller = module.get<MetaController>(MetaController);
    bootstrapService = module.get<BootstrapService>(BootstrapService);
    hookService = module.get<HookService>(HookService);
    settingCoreService = module.get<SettingCoreService>(SettingCoreService);

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Controller initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
      expect(bootstrapService).toBeDefined();
      expect(hookService).toBeDefined();
      expect(settingCoreService).toBeDefined();
    });
  });

  describe('getMeta', () => {
    describe('Happy path scenarios', () => {
      it('should return correctly formatted meta data with all expected fields', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        expect(result).toEqual({
          statusCode: 200,
          data: expect.objectContaining({
            version: TEST_VERSION,
            tags: mockBootstrapData.tags,
            totalArticles: mockBootstrapData.totalArticles,
            totalWordCount: mockBootstrapData.totalWordCount,
            meta: expect.objectContaining({
              links: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Tech News',
                  url: 'https://technews.com',
                  desc: 'Latest technology news',
                  logo: 'https://example.com/logo.png',
                  updatedAt: expect.any(String),
                }),
                expect.objectContaining({
                  name: 'Dev Community',
                  url: 'https://dev.community',
                  desc: 'Developer community platform',
                  logo: 'https://example.com/dev-logo.png',
                  updatedAt: expect.any(String),
                }),
              ]),
              categories: mockBootstrapData.categories,
              about: {
                content: TEST_ABOUT_CONTENT,
                updatedAt: TEST_DATE,
              },
              siteInfo: mockBootstrapData.siteInfo,
              extensions: mockBootstrapData.extensions,
            }),
            menus: expect.arrayContaining([
              expect.objectContaining({
                id: expect.any(Number),
                name: 'Home',
                value: '/',
                level: 0,
              }),
              expect.objectContaining({
                id: expect.any(Number),
                name: 'Articles',
                value: '/articles',
                level: 1,
              }),
              expect.objectContaining({
                id: expect.any(Number),
                name: 'Web Development',
                value: '/articles/web-dev',
                level: 2,
              }),
            ]),
          }),
        });

        // Verify navigation flattening
        const menus = result.data.menus;
        expect(menus).toHaveLength(6); // Home + 2 children + Resources + 2 children of Articles

        // Verify IDs are unique and sequential
        const ids = menus.map((menu: any) => menu.id);
        expect(new Set(ids).size).toBe(ids.length); // All IDs are unique

        // Verify mock calls
        expect(bootstrapService.getPublicBootstrap).toHaveBeenCalledTimes(1);
        expect(settingCoreService.getAboutInfo).toHaveBeenCalledTimes(1);
        expect(hookService.applyFilters).toHaveBeenCalledTimes(1);
      });

      it('should transform friend links correctly', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        const links = result.data.meta.links;

        expect(links[0]).toMatchObject({
          name: 'Tech News',
          url: 'https://technews.com',
          desc: 'Latest technology news',
          logo: 'https://example.com/logo.png',
        });
        expect(links[0].updatedAt).toBeInstanceOf(String);
        expect(dayjs(links[0].updatedAt).isValid()).toBe(true);
      });

      it('should flatten navigation structure correctly', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        const menus = result.data.menus;

        // Verify root level items
        const rootItems = menus.filter((menu: any) => menu.level === 0);
        expect(rootItems).toHaveLength(2); // Home, Resources
        expect(rootItems.map((m: any) => m.name)).toContain('Home');
        expect(rootItems.map((m: any) => m.name)).toContain('Resources');

        // Verify first level items
        const firstLevelItems = menus.filter((menu: any) => menu.level === 1);
        expect(firstLevelItems).toHaveLength(1); // Articles (child of Home)
        expect(firstLevelItems[0].name).toBe('Articles');
        expect(firstLevelItems[0].value).toBe('/articles');

        // Verify second level items
        const secondLevelItems = menus.filter((menu: any) => menu.level === 2);
        expect(secondLevelItems).toHaveLength(2); // Web Development, JavaScript
        expect(secondLevelItems.map((m: any) => m.name)).toContain('Web Development');
        expect(secondLevelItems.map((m: any) => m.name)).toContain('JavaScript');
      });

      it('should preserve plugin extensions in meta response', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        expect(result.data.meta.extensions).toEqual(mockBootstrapData.extensions);
        expect(result.data.meta.extensions.rewards).toHaveLength(2);
        expect(result.data.meta.extensions.rewards[0].name).toBe('Buy Me a Coffee');
      });

      it('should handle empty arrays gracefully', async () => {
        // Arrange
        const emptyBootstrapData = {
          ...mockBootstrapData,
          tags: [],
          categories: [],
          friendLinks: [],
          navigation: [],
        };

        mockBootstrapService.getPublicBootstrap.mockResolvedValue(emptyBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        expect(result.data.meta.links).toHaveLength(0);
        expect(result.data.meta.categories).toHaveLength(0);
        expect(result.data.menus).toHaveLength(0);
      });
    });

    describe('Error handling scenarios', () => {
      it('should fallback to original data when filter hooks throw error', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockRejectedValue(new Error('Filter processing failed'));

        // Act
        const result = await controller.getMeta();

        // Assert
        expect(result.statusCode).toBe(200);
        expect(result.data.meta.about).toEqual({
          content: TEST_ABOUT_CONTENT,
          updatedAt: TEST_DATE,
        });
        expect(result.data.meta.extensions).toEqual(mockBootstrapData.extensions);
      });

      it('should handle bootstrap service errors gracefully', async () => {
        // Arrange
        const errorBootstrap = {
          ...mockBootstrapData,
          tags: [],
          totalArticles: 0,
          totalWordCount: 0,
          siteInfo: {},
          friendLinks: [],
          categories: [],
          navigation: [],
          extensions: {},
        };

        mockBootstrapService.getPublicBootstrap.mockResolvedValue(errorBootstrap);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        expect(result.statusCode).toBe(200);
        expect(result.data.meta.links).toHaveLength(0);
        expect(result.data.meta.categories).toHaveLength(0);
        expect(result.data.menus).toHaveLength(0);
      });

      it('should handle about info service errors', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockRejectedValue(
          new Error('Failed to get about info'),
        );
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        expect(result.statusCode).toBe(200);
        // Should still have about structure but with default/empty content
        expect(result.data.meta.about).toEqual({
          content: undefined,
          updatedAt: undefined,
        });
      });
    });

    describe('Data transformation edge cases', () => {
      it('should handle navigation with missing path or value fields', async () => {
        // Arrange
        const bootstrapWithMissingPath = {
          ...mockBootstrapData,
          navigation: [
            {
              name: 'Home',
              // missing path and value
              children: [
                {
                  name: 'No Path',
                  // missing path and value
                },
              ],
            },
          ],
        };

        mockBootstrapService.getPublicBootstrap.mockResolvedValue(bootstrapWithMissingPath);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        const menus = result.data.menus;
        expect(menus).toHaveLength(2); // Home + No Path

        // Missing path/value should default to empty string
        expect(menus[0].value).toBe('');
        expect(menus[1].value).toBe('');
      });

      it('should handle navigation with circular references in children', async () => {
        // Arrange
        const circularNavigation = [
          {
            name: 'Home',
            path: '/',
            children: [
              {
                name: 'Child',
                path: '/child',
                children: [], // Will be filled with circular reference
              },
            ],
          },
        ];

        // Create circular reference
        circularNavigation[0].children[0].children = circularNavigation;

        const bootstrapWithCircular = {
          ...mockBootstrapData,
          navigation: circularNavigation,
        };

        mockBootstrapService.getPublicBootstrap.mockResolvedValue(bootstrapWithCircular);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        // Should handle circular references without stack overflow
        expect(result.statusCode).toBe(200);
        expect(result.data.menus).toHaveLength(2); // Home + Child
      });

      it('should handle friend links with missing optional fields', async () => {
        // Arrange
        const bootstrapWithMinimalLinks = {
          ...mockBootstrapData,
          friendLinks: [
            {
              name: 'Minimal Link',
              url: 'https://minimal.com',
              // Missing description and avatar
            },
          ],
        };

        mockBootstrapService.getPublicBootstrap.mockResolvedValue(bootstrapWithMinimalLinks);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        const links = result.data.meta.links;
        expect(links).toHaveLength(1);
        expect(links[0]).toMatchObject({
          name: 'Minimal Link',
          url: 'https://minimal.com',
          desc: undefined,
          logo: undefined,
        });
      });
    });

    describe('Hook service integration', () => {
      it('should apply filters with correct parameters', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);

        const mockFilterImplementation = vi.fn().mockImplementation(
          async (_hook, data) =>
            await {
              ...data,
              meta: {
                ...data.meta,
                customField: 'modified by filter',
              },
            },
        );

        mockHookService.applyFilters.mockImplementation(mockFilterImplementation);

        // Act
        const result = await controller.getMeta();

        // Assert
        expect(mockFilterImplementation).toHaveBeenCalledTimes(1);
        expect(mockFilterImplementation).toHaveBeenCalledWith(
          'public|metaResponse',
          expect.any(Object),
          { action: 'public' },
        );

        expect(result.data.meta.customField).toBe('modified by filter');
      });

      it('should preserve data integrity after filter transformation', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);

        const transformedData = {
          ...mockBootstrapData,
          meta: {
            ...mockBootstrapData.meta,
            version: 'modified-version',
          },
        };

        mockHookService.applyFilters.mockImplementation(async (_hook, _data) => transformedData);

        // Act
        const result = await controller.getMeta();

        // Assert
        expect(result.data.version).toBe('modified-version');
        expect(result.data.meta.siteInfo).toEqual(mockBootstrapData.siteInfo);
        expect(result.data.meta.links).toHaveLength(2);
      });
    });

    describe('Performance and concurrency', () => {
      it('should handle concurrent requests without race conditions', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act - Execute multiple concurrent requests
        const requests = Array.from({ length: 5 }, () => controller.getMeta());
        const results = await Promise.all(requests);

        // Assert
        results.forEach((result, _index) => {
          expect(result.statusCode).toBe(200);
          expect(result.data.version).toBe(TEST_VERSION);
          expect(result.data.meta.links).toHaveLength(2);
          expect(result.data.menus).toHaveLength(7);
        });

        // Verify each mock was called exactly once (not multiple times)
        expect(bootstrapService.getPublicBootstrap).toHaveBeenCalledTimes(1);
        expect(settingCoreService.getAboutInfo).toHaveBeenCalledTimes(1);
        expect(hookService.applyFilters).toHaveBeenCalledTimes(1);
      });

      it('should complete within reasonable time', async () => {
        // Arrange
        const startTime = Date.now();
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();
        const endTime = Date.now();

        // Assert
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(100); // Should complete within 100ms
        expect(result.statusCode).toBe(200);
      });
    });

    describe('Schema validation', () => {
      it('should return data that matches PublicMetaSchema structure', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        // Verify top-level structure
        expect(result).toHaveProperty('statusCode', 200);
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('version', TEST_VERSION);
        expect(result.data).toHaveProperty('tags');
        expect(result.data).toHaveProperty('totalArticles');
        expect(result.data).toHaveProperty('totalWordCount');
        expect(result.data).toHaveProperty('meta');
        expect(result.data).toHaveProperty('menus');

        // Verify meta object structure
        expect(result.data.meta).toHaveProperty('links');
        expect(result.data.meta).toHaveProperty('categories');
        expect(result.data.meta).toHaveProperty('about');
        expect(result.data.meta).toHaveProperty('siteInfo');
        expect(result.data.meta).toHaveProperty('extensions');

        // Verify array types
        expect(Array.isArray(result.data.meta.links)).toBe(true);
        expect(Array.isArray(result.data.meta.categories)).toBe(true);
        expect(Array.isArray(result.data.menus)).toBe(true);
      });

      it('should ensure all required string fields are present', async () => {
        // Arrange
        mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBootstrapData);
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAboutInfo);
        mockHookService.applyFilters.mockImplementation(async (_hook, data) => await data);

        // Act
        const result = await controller.getMeta();

        // Assert
        // Check string fields exist and are strings
        expect(typeof result.data.version).toBe('string');
        expect(typeof result.data.meta.about.content).toBe('string');
        expect(typeof result.data.meta.about.updatedAt).toBe('string');
        expect(typeof result.data.meta.siteInfo.title).toBe('string');
        expect(typeof result.data.meta.siteInfo.description).toBe('string');
        expect(typeof result.data.meta.siteInfo.author).toBe('string');

        // Check that all link items have required string fields
        result.data.meta.links.forEach((link: any) => {
          expect(typeof link.name).toBe('string');
          expect(typeof link.url).toBe('string');
        });

        // Check that all menu items have required fields
        result.data.menus.forEach((menu: any) => {
          expect(typeof menu.name).toBe('string');
          expect(typeof menu.value).toBe('string');
          expect(typeof menu.level).toBe('number');
        });
      });
    });
  });
});
