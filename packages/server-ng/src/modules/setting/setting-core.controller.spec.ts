import { Test, type TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import {
  SettingCoreService,
  type SiteInfo,
  type SiteLayout,
  type SiteTheme,
  type FriendLink,
  type Navigation,
  type CustomCode,
} from './services/setting-core.service';
import { SettingCoreController } from './setting-core.controller';

describe('SettingCoreController', () => {
  let controller: SettingCoreController;
  let mockSettingCoreService: any;

  beforeEach(async () => {
    mockSettingCoreService = {
      getSiteInfo: vi.fn(),
      updateSiteInfo: vi.fn(),
      getLayoutSettings: vi.fn(),
      updateLayoutSettings: vi.fn(),
      getThemeSettings: vi.fn(),
      updateThemeSettings: vi.fn(),
      getFriendLinks: vi.fn(),
      createFriendLink: vi.fn(),
      updateFriendLink: vi.fn(),
      deleteFriendLink: vi.fn(),
      getNavigation: vi.fn(),
      updateNavigation: vi.fn(),
      getCustomCode: vi.fn(),
      updateCustomCode: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingCoreController],
      providers: [
        {
          provide: SettingCoreService,
          useValue: mockSettingCoreService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SettingCoreController>(SettingCoreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSiteInfo', () => {
    it('should return site information', async () => {
      const mockSiteInfo: SiteInfo = {
        title: 'Test Blog',
        description: 'Test Description',
        keywords: ['test', 'blog'],
        author: 'Test Author',
      };

      mockSettingCoreService.getSiteInfo.mockResolvedValue(mockSiteInfo);

      const result = await controller.getSiteInfo();

      expect(result).toEqual(mockSiteInfo);
      expect(mockSettingCoreService.getSiteInfo).toHaveBeenCalled();
    });
  });

  describe('updateSiteInfo', () => {
    it('should update site information', async () => {
      const updateDto = {
        siteName: 'Updated Blog',
        siteDescription: 'Updated Description',
      };
      const updatedSiteInfo: SiteInfo = {
        title: 'Updated Blog',
        description: 'Updated Description',
        keywords: ['test', 'blog'],
        author: 'Test Author',
      };

      mockSettingCoreService.updateSiteInfo.mockResolvedValue(updatedSiteInfo);

      const result = await controller.updateSiteInfo(updateDto);

      expect(result).toEqual(updatedSiteInfo);
      // Controller maps input DTO to SiteInfo fields before calling service
      const expectedParam = {
        title: updateDto.siteName,
        description: updateDto.siteDescription,
        author: '',
        keywords: [],
      };
      expect(mockSettingCoreService.updateSiteInfo).toHaveBeenCalledWith(expectedParam);
    });

    it('should split keywords and map authorName correctly', async () => {
      const updateDto = {
        siteName: 'My Blog',
        siteDescription: 'Desc',
        siteKeywords: 'a, b , c',
        authorName: 'Linus',
      };
      const updatedSiteInfo: SiteInfo = {
        title: 'My Blog',
        description: 'Desc',
        keywords: ['a', 'b', 'c'],
        author: 'Linus',
      };

      mockSettingCoreService.updateSiteInfo.mockResolvedValue(updatedSiteInfo);

      const result = await controller.updateSiteInfo(updateDto as any);

      expect(result).toEqual(updatedSiteInfo);
      const expectedParam = {
        title: 'My Blog',
        description: 'Desc',
        author: 'Linus',
        keywords: ['a', 'b', 'c'],
      };
      expect(mockSettingCoreService.updateSiteInfo).toHaveBeenCalledWith(expectedParam);
    });
  });

  describe('getLayoutSettings', () => {
    it('should return layout settings', async () => {
      const mockLayout: SiteLayout = {
        showRecentPosts: true,
        recentPostsCount: 5,
        showCategories: true,
        showTags: true,
        showArchive: true,
        showAbout: true,
        showSearch: true,
      };

      mockSettingCoreService.getLayoutSettings.mockResolvedValue(mockLayout);

      const result = await controller.getLayoutSettings();

      expect(result).toEqual(mockLayout);
      expect(mockSettingCoreService.getLayoutSettings).toHaveBeenCalled();
    });
  });

  describe('updateLayoutSettings', () => {
    it('should update layout settings', async () => {
      const updateDto = {
        showRecentPosts: false,
        recentPostsCount: 3,
        showCategories: false,
        showTags: true,
        showArchive: true,
        showAbout: true,
        showSearch: true,
      };
      const updatedLayout: SiteLayout = {
        showRecentPosts: false,
        recentPostsCount: 3,
        showCategories: false,
        showTags: true,
        showArchive: true,
        showAbout: true,
        showSearch: true,
      };

      mockSettingCoreService.updateLayoutSettings.mockResolvedValue(updatedLayout);

      const result = await controller.updateLayoutSettings(updateDto);

      expect(result).toEqual(updatedLayout);
      expect(mockSettingCoreService.updateLayoutSettings).toHaveBeenCalledWith(updateDto);
    });
  });

  describe('getThemeSettings', () => {
    it('should return theme settings', async () => {
      const mockTheme: SiteTheme = {
        primaryColor: '#007bff',
        darkMode: false,
      };

      mockSettingCoreService.getThemeSettings.mockResolvedValue(mockTheme);

      const result = await controller.getThemeSettings();

      expect(result).toEqual(mockTheme);
      expect(mockSettingCoreService.getThemeSettings).toHaveBeenCalled();
    });
  });

  describe('updateThemeSettings', () => {
    it('should update theme settings', async () => {
      const updateDto = {
        theme: 'dark',
        customCss: 'body { background: #000; }',
      };
      const updatedTheme: SiteTheme = {
        primaryColor: '#28a745',
        darkMode: true,
      };

      mockSettingCoreService.updateThemeSettings.mockResolvedValue(updatedTheme);

      const result = await controller.updateThemeSettings(updateDto);

      expect(result).toEqual(updatedTheme);
      // Controller maps theme dto to { primaryColor, darkMode }
      const expectedThemeParam = {
        primaryColor: updateDto.theme !== '' ? updateDto.theme : '#000000',
        darkMode: false,
      };
      expect(mockSettingCoreService.updateThemeSettings).toHaveBeenCalledWith(expectedThemeParam);
    });
  });

  describe('getFriendLinks', () => {
    it('should return friend links', async () => {
      const mockFriendLinks: FriendLink[] = [
        {
          name: 'Friend 1',
          url: 'https://friend1.com',
          description: 'Friend 1 description',
        },
        {
          name: 'Friend 2',
          url: 'https://friend2.com',
          description: 'Friend 2 description',
        },
      ];

      mockSettingCoreService.getFriendLinks.mockResolvedValue(mockFriendLinks);

      const result = await controller.getFriendLinks();

      expect(result).toEqual(mockFriendLinks);
      expect(mockSettingCoreService.getFriendLinks).toHaveBeenCalled();
    });
  });

  describe('createFriendLink', () => {
    it('should create a new friend link', async () => {
      const createDto = {
        name: 'New Friend',
        url: 'https://newfriend.com',
        description: 'New friend description',
      };
      const updatedFriendLinks: FriendLink[] = [
        {
          name: 'New Friend',
          url: 'https://newfriend.com',
          description: 'New friend description',
        },
      ];

      mockSettingCoreService.createFriendLink.mockResolvedValue(updatedFriendLinks);

      const result = await controller.createFriendLink(createDto);

      expect(result).toEqual(updatedFriendLinks);
      expect(mockSettingCoreService.createFriendLink).toHaveBeenCalledWith(createDto);
    });
  });

  describe('updateFriendLink', () => {
    it('should update a friend link by index', async () => {
      const index = 0;
      const updateDto = {
        name: 'Updated Friend',
        url: 'https://updatedfriend.com',
        description: 'Updated description',
      };
      const updatedFriendLinks: FriendLink[] = [
        {
          name: 'Updated Friend',
          url: 'https://updatedfriend.com',
          description: 'Updated description',
        },
      ];

      mockSettingCoreService.updateFriendLink.mockResolvedValue(updatedFriendLinks);

      const result = await controller.updateFriendLink(index, updateDto);

      expect(result).toEqual(updatedFriendLinks);
      expect(mockSettingCoreService.updateFriendLink).toHaveBeenCalledWith(index, updateDto);
    });
  });

  describe('deleteFriendLink', () => {
    it('should delete a friend link by index', async () => {
      const index = 0;
      const updatedFriendLinks: FriendLink[] = [];

      mockSettingCoreService.deleteFriendLink.mockResolvedValue(updatedFriendLinks);

      const result = await controller.deleteFriendLink(index);

      expect(result).toEqual(updatedFriendLinks);
      expect(mockSettingCoreService.deleteFriendLink).toHaveBeenCalledWith(index);
    });
  });

  describe('getNavigation', () => {
    it('should return navigation items', async () => {
      const mockNavigation: Navigation[] = [
        {
          name: 'Home',
          path: '/',
          external: false,
        },
        {
          name: 'About',
          path: '/about',
          external: false,
        },
      ];

      mockSettingCoreService.getNavigation.mockResolvedValue(mockNavigation);

      const result = await controller.getNavigation();

      expect(result).toEqual(mockNavigation);
      expect(mockSettingCoreService.getNavigation).toHaveBeenCalled();
    });
  });

  describe('updateNavigation', () => {
    it('should update navigation items', async () => {
      const updateDto = {
        items: [
          {
            name: 'Home',
            url: '/',
            target: '_self' as const,
            order: 0,
          },
          {
            name: 'Blog',
            url: '/blog',
            target: '_self' as const,
            order: 1,
          },
        ],
      };
      const updatedNavigation: Navigation[] = [
        {
          name: 'Home',
          path: '/',
          external: false,
        },
        {
          name: 'Blog',
          path: '/blog',
          external: false,
        },
      ];

      mockSettingCoreService.updateNavigation.mockResolvedValue(updatedNavigation);

      const result = await controller.updateNavigation(updateDto);

      expect(result).toEqual(updatedNavigation);
      // Controller maps NavigationItem -> Navigation before calling service
      const mapItem = (item: any): any => ({
        name: item.name,
        path: item.url,
        icon: item.icon,
        external: item.target === '_blank',
        children: item.children?.map(mapItem),
      });
      const expectedNavParam = updateDto.items.map(mapItem);
      expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith(expectedNavParam);
    });

    it('should map nested children recursively and external links', async () => {
      const updateDto = {
        items: [
          {
            name: 'Root',
            url: '/',
            target: '_self' as const,
            order: 0,
            children: [
              {
                name: 'Docs',
                url: '/docs',
                target: '_self' as const,
                order: 0,
                children: [
                  {
                    name: 'API',
                    url: 'https://api.example.com',
                    target: '_blank' as const,
                    order: 0,
                  },
                ],
              },
              {
                name: 'Blog',
                url: '/blog',
                target: '_self' as const,
                order: 1,
              },
            ],
          },
        ],
      };

      const expectedParam: Navigation[] = [
        {
          name: 'Root',
          path: '/',
          icon: undefined,
          external: false,
          children: [
            {
              name: 'Docs',
              path: '/docs',
              icon: undefined,
              external: false,
              children: [
                {
                  name: 'API',
                  path: 'https://api.example.com',
                  icon: undefined,
                  external: true,
                  children: undefined,
                },
              ],
            },
            {
              name: 'Blog',
              path: '/blog',
              icon: undefined,
              external: false,
              children: undefined,
            },
          ],
        },
      ];

      mockSettingCoreService.updateNavigation.mockResolvedValue(expectedParam);

      const result = await controller.updateNavigation(updateDto as any);

      expect(result).toEqual(expectedParam);
      expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith(expectedParam);
    });
  });

  describe('getCustomCode', () => {
    it('should return custom code settings', async () => {
      const mockCustomCode: CustomCode = {
        head: '<meta name="custom" content="test">',
        body: '<script>console.log("test")</script>',
        footer: '<div>Footer content</div>',
      };

      mockSettingCoreService.getCustomCode.mockResolvedValue(mockCustomCode);

      const result = await controller.getCustomCode();

      expect(result).toEqual(mockCustomCode);
      expect(mockSettingCoreService.getCustomCode).toHaveBeenCalled();
    });
  });

  describe('updateCustomCode', () => {
    it('should update custom code settings', async () => {
      const updateDto = {
        head: '<meta name="updated" content="test">',
        body: '<script>console.log("updated")</script>',
      };
      const updatedCustomCode: CustomCode = {
        head: '<meta name="updated" content="test">',
        body: '<script>console.log("updated")</script>',
        footer: '<div>Footer content</div>',
      };

      mockSettingCoreService.updateCustomCode.mockResolvedValue(updatedCustomCode);

      const result = await controller.updateCustomCode(updateDto);

      expect(result).toEqual(updatedCustomCode);
      expect(mockSettingCoreService.updateCustomCode).toHaveBeenCalledWith(updateDto);
    });
  });
});
