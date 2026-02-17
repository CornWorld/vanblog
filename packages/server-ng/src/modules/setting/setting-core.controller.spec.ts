import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs, type FriendLink } from '@vanblog/shared';

import {
  SettingCoreService,
  type SiteInfo,
  type SiteLayout,
  type SiteTheme,
  type Navigation,
  type CustomCode,
  type AboutInfo,
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
      getAboutInfo: vi.fn(),
      updateAboutInfo: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingCoreController],
      providers: [
        {
          provide: SettingCoreService,
          useValue: mockSettingCoreService,
        },
      ],
    }).compile();

    controller = module.get<SettingCoreController>(SettingCoreController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSiteInfo', () => {
    it('should call service and return site info', async () => {
      const mockSiteInfo: SiteInfo = {
        title: 'Test Blog',
        description: 'Test Description',
        keywords: ['test'],
        author: 'Test Author',
      };
      mockSettingCoreService.getSiteInfo.mockResolvedValue(mockSiteInfo);

      const result = await controller.getSiteInfo();

      expect(result).toEqual(mockSiteInfo);
      expect(mockSettingCoreService.getSiteInfo).toHaveBeenCalled();
    });
  });

  describe('updateSiteInfo', () => {
    it('should call service with body and return updated site info', async () => {
      const updatedSiteInfo: SiteInfo = {
        title: 'Updated Blog',
        description: 'Updated Description',
        keywords: ['test'],
        author: 'Test Author',
      };
      mockSettingCoreService.updateSiteInfo.mockResolvedValue(updatedSiteInfo);

      const body = {
        title: 'Updated Blog',
        description: 'Updated Description',
        keywords: ['test'],
        author: 'Test Author',
      };
      const result = await controller.updateSiteInfo(body);

      expect(result).toEqual(updatedSiteInfo);
      expect(mockSettingCoreService.updateSiteInfo).toHaveBeenCalledWith(body);
    });
  });

  describe('getLayoutSettings', () => {
    it('should call service and return layout settings', async () => {
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
    });
  });

  describe('updateLayoutSettings', () => {
    it('should call service with body and return updated layout', async () => {
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

      const result = await controller.updateLayoutSettings(updatedLayout);

      expect(result).toEqual(updatedLayout);
      expect(mockSettingCoreService.updateLayoutSettings).toHaveBeenCalledWith(updatedLayout);
    });
  });

  describe('getThemeSettings', () => {
    it('should call service and return theme settings', async () => {
      const mockTheme: SiteTheme = {
        primaryColor: '#007bff',
        darkMode: false,
      };
      mockSettingCoreService.getThemeSettings.mockResolvedValue(mockTheme);

      const result = await controller.getThemeSettings();

      expect(result).toEqual(mockTheme);
    });
  });

  describe('updateThemeSettings', () => {
    it('should call service with body and return updated theme', async () => {
      const updatedTheme: SiteTheme = {
        primaryColor: '#ff0000',
        darkMode: false,
      };
      mockSettingCoreService.updateThemeSettings.mockResolvedValue(updatedTheme);

      const result = await controller.updateThemeSettings({
        primaryColor: '#ff0000',
        darkMode: false,
      });

      expect(result).toEqual(updatedTheme);
      expect(mockSettingCoreService.updateThemeSettings).toHaveBeenCalledWith({
        primaryColor: '#ff0000',
        darkMode: false,
      });
    });
  });

  describe('getFriendLinks', () => {
    it('should call service and return friend links', async () => {
      const mockLinks: FriendLink[] = [
        {
          id: 1,
          name: 'Friend',
          url: 'https://friend.com',
          description: 'Desc',
          createTime: '2024-01-01T00:00:00Z',
          updateTime: '2024-01-01T00:00:00Z',
        },
      ];
      mockSettingCoreService.getFriendLinks.mockResolvedValue(mockLinks);

      const result = await controller.getFriendLinks();

      expect(result).toEqual(mockLinks);
    });
  });

  describe('createFriendLink', () => {
    it('should call service with body and return created link', async () => {
      const newLink: FriendLink = {
        id: 1,
        name: 'New Friend',
        url: 'https://newfriend.com',
        description: 'New description',
        createTime: '2024-01-01T00:00:00Z',
        updateTime: '2024-01-01T00:00:00Z',
        avatar: 'https://avatar.com',
      };
      mockSettingCoreService.createFriendLink.mockResolvedValue(newLink);

      const body = {
        name: 'New Friend',
        url: 'https://newfriend.com',
        description: 'New description',
        avatar: 'https://avatar.com',
      };
      const result = await controller.createFriendLink(body);

      expect(result).toEqual(newLink);
      expect(mockSettingCoreService.createFriendLink).toHaveBeenCalledWith(body);
    });
  });

  describe('updateFriendLink', () => {
    it('should call service with index and body', async () => {
      const updated: FriendLink = {
        id: 1,
        name: 'Updated',
        url: 'https://updated.com',
        description: 'Updated desc',
        createTime: '2024-01-01T00:00:00Z',
        updateTime: '2024-01-02T00:00:00Z',
      };
      mockSettingCoreService.updateFriendLink.mockResolvedValue(updated);

      const body = { name: 'Updated', url: 'https://updated.com', description: 'Updated desc' };
      const result = await controller.updateFriendLink(0, body);

      expect(result).toEqual(updated);
      expect(mockSettingCoreService.updateFriendLink).toHaveBeenCalledWith(0, body);
    });
  });

  describe('deleteFriendLink', () => {
    it('should call service with index from params', async () => {
      const remaining: FriendLink[] = [];
      mockSettingCoreService.deleteFriendLink.mockResolvedValue(remaining);

      const result = await controller.deleteFriendLink(0);

      expect(result).toEqual(remaining);
      expect(mockSettingCoreService.deleteFriendLink).toHaveBeenCalledWith(0);
    });
  });

  describe('getNavigation', () => {
    it('should call service and return navigation', async () => {
      const mockNav: Navigation[] = [
        { name: 'Home', path: '/', external: false },
        { name: 'About', path: '/about', external: false },
      ];
      mockSettingCoreService.getNavigation.mockResolvedValue(mockNav);

      const result = await controller.getNavigation();

      expect(result).toEqual(mockNav);
    });
  });

  describe('updateNavigation', () => {
    it('should extract items from body and call service', async () => {
      const updated: Navigation[] = [
        { name: 'Home', path: '/', icon: undefined, external: false, children: undefined },
      ];
      mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

      const result = await controller.updateNavigation({
        items: [{ name: 'Home', path: '/', external: false }],
      });

      expect(result).toEqual(updated);
      expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([
        { name: 'Home', path: '/', external: false },
      ]);
    });

    it('should handle external links correctly', async () => {
      const updated: Navigation[] = [
        { name: 'External', path: 'https://example.com', external: true },
      ];
      mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

      await controller.updateNavigation({
        items: [{ name: 'External', path: 'https://example.com', external: true }],
      });

      expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([
        { name: 'External', path: 'https://example.com', external: true },
      ]);
    });

    it('should map nested children recursively', async () => {
      const updated: Navigation[] = [
        {
          name: 'Root',
          path: '/',
          external: false,
          children: [
            {
              name: 'Child',
              path: '/child',
              external: false,
            },
          ],
        },
      ];
      mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

      await controller.updateNavigation({
        items: [
          {
            name: 'Root',
            path: '/',
            external: false,
            children: [{ name: 'Child', path: '/child', external: false }],
          },
        ],
      });

      expect(mockSettingCoreService.updateNavigation).toHaveBeenCalled();
      const [[items]] = mockSettingCoreService.updateNavigation.mock.calls;
      expect(items[0].children).toBeDefined();
      expect(items[0].children[0].name).toBe('Child');
    });

    it('should handle navigation items without children', async () => {
      const updated: Navigation[] = [
        { name: 'Home', path: '/', icon: undefined, external: false, children: undefined },
      ];
      mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

      await controller.updateNavigation({
        items: [{ name: 'Home', path: '/', external: false }],
      });

      expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([
        { name: 'Home', path: '/', external: false },
      ]);
    });

    it('should handle navigation items with icon', async () => {
      const updated: Navigation[] = [
        {
          name: 'Home',
          path: '/',
          icon: 'home-icon',
          external: false,
          children: undefined,
        },
      ];
      mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

      await controller.updateNavigation({
        items: [{ name: 'Home', path: '/', icon: 'home-icon', external: false }],
      });

      expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([
        { name: 'Home', path: '/', icon: 'home-icon', external: false },
      ]);
    });

    it('should handle empty navigation items array', async () => {
      const updated: Navigation[] = [];
      mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

      await controller.updateNavigation({ items: [] });

      expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([]);
    });
  });

  describe('getCustomCode', () => {
    it('should call service and return custom code', async () => {
      const mockCode: CustomCode = {
        head: '<meta>',
        script: '<script>',
        html: '<div>',
      };
      mockSettingCoreService.getCustomCode.mockResolvedValue(mockCode);

      const result = await controller.getCustomCode();

      expect(result).toEqual(mockCode);
    });
  });

  describe('updateCustomCode', () => {
    it('should call service with body and return updated custom code', async () => {
      const updated: CustomCode = {
        head: '<meta name="updated">',
        script: '<script>updated</script>',
        html: '<div>updated</div>',
      };
      mockSettingCoreService.updateCustomCode.mockResolvedValue(updated);

      const result = await controller.updateCustomCode(updated);

      expect(result).toEqual(updated);
      expect(mockSettingCoreService.updateCustomCode).toHaveBeenCalledWith(updated);
    });
  });

  describe('getAbout', () => {
    it('should call service and return about info', async () => {
      const mockAbout: AboutInfo = {
        content: 'About me',
        updatedAt: dayjs().format(),
      };
      mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAbout);

      const result = await controller.getAbout();

      expect(result).toEqual(mockAbout);
    });
  });

  describe('updateAbout', () => {
    it('should call service with body and return updated about info', async () => {
      const updated: AboutInfo = {
        content: 'Updated about',
        updatedAt: dayjs().format(),
      };
      mockSettingCoreService.updateAboutInfo.mockResolvedValue(updated);

      const result = await controller.updateAbout({ content: 'Updated about' });

      expect(result).toEqual(updated);
      expect(mockSettingCoreService.updateAboutInfo).toHaveBeenCalledWith({
        content: 'Updated about',
      });
    });
  });
});
