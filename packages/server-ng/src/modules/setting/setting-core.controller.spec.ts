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

  // ts-rest handlers tests
  describe('ts-rest handlers', () => {
    describe('getSiteInfo', () => {
      it('should return ts-rest handler function', () => {
        const handler = controller.getSiteInfo();
        expect(handler).toBeDefined();
        expect(typeof handler).toBe('function');
      });

      it('should call service and return formatted response', async () => {
        const mockSiteInfo: SiteInfo = {
          title: 'Test Blog',
          description: 'Test Description',
          keywords: ['test'],
          author: 'Test Author',
        };
        mockSettingCoreService.getSiteInfo.mockResolvedValue(mockSiteInfo);

        const handler = controller.getSiteInfo();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockSiteInfo });
        expect(mockSettingCoreService.getSiteInfo).toHaveBeenCalled();
      });
    });

    describe('updateSiteInfo', () => {
      it('should return ts-rest handler function', () => {
        const handler = controller.updateSiteInfo();
        expect(handler).toBeDefined();
        expect(typeof handler).toBe('function');
      });

      it('should call service with body and return formatted response', async () => {
        const updatedSiteInfo: SiteInfo = {
          title: 'Updated Blog',
          description: 'Updated Description',
          keywords: ['test'],
          author: 'Test Author',
        };
        mockSettingCoreService.updateSiteInfo.mockResolvedValue(updatedSiteInfo);

        const handler = controller.updateSiteInfo();
        const response = await handler({
          body: {
            title: 'Updated Blog',
            description: 'Updated Description',
            keywords: ['test'],
            author: 'Test Author',
          },
        } as any);

        expect(response).toEqual({ status: 200, body: updatedSiteInfo });
        expect(mockSettingCoreService.updateSiteInfo).toHaveBeenCalledWith({
          title: 'Updated Blog',
          description: 'Updated Description',
          keywords: ['test'],
          author: 'Test Author',
        });
      });
    });

    describe('getLayoutSettings', () => {
      it('should return ts-rest handler function', () => {
        const handler = controller.getLayoutSettings();
        expect(handler).toBeDefined();
      });

      it('should call service and return formatted response', async () => {
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

        const handler = controller.getLayoutSettings();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockLayout });
      });
    });

    describe('updateLayoutSettings', () => {
      it('should call service with body and return formatted response', async () => {
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

        const handler = controller.updateLayoutSettings();
        const response = await handler({ body: updatedLayout } as any);

        expect(response).toEqual({ status: 200, body: updatedLayout });
        expect(mockSettingCoreService.updateLayoutSettings).toHaveBeenCalledWith(updatedLayout);
      });
    });

    describe('getThemeSettings', () => {
      it('should call service and return formatted response', async () => {
        const mockTheme: SiteTheme = {
          primaryColor: '#007bff',
          darkMode: false,
        };
        mockSettingCoreService.getThemeSettings.mockResolvedValue(mockTheme);

        const handler = controller.getThemeSettings();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockTheme });
      });
    });

    describe('updateThemeSettings', () => {
      it('should call service with body and return formatted response', async () => {
        const updatedTheme: SiteTheme = {
          primaryColor: '#ff0000',
          darkMode: false,
        };
        mockSettingCoreService.updateThemeSettings.mockResolvedValue(updatedTheme);

        const handler = controller.updateThemeSettings();
        const response = await handler({
          body: { primaryColor: '#ff0000', darkMode: false },
        } as any);

        expect(response).toEqual({ status: 200, body: updatedTheme });
        expect(mockSettingCoreService.updateThemeSettings).toHaveBeenCalledWith({
          primaryColor: '#ff0000',
          darkMode: false,
        });
      });
    });

    describe('getFriendLinks', () => {
      it('should call service and return formatted response', async () => {
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

        const handler = controller.getFriendLinks();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockLinks });
      });
    });

    describe('createFriendLink', () => {
      it('should call service with body and return 201', async () => {
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

        const handler = controller.createFriendLink();
        const response = await handler({
          body: {
            name: 'New Friend',
            url: 'https://newfriend.com',
            description: 'New description',
            avatar: 'https://avatar.com',
          },
        } as any);

        expect(response).toEqual({ status: 201, body: newLink });
        expect(mockSettingCoreService.createFriendLink).toHaveBeenCalledWith({
          name: 'New Friend',
          url: 'https://newfriend.com',
          description: 'New description',
          avatar: 'https://avatar.com',
        });
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

        const handler = controller.updateFriendLink();
        const response = await handler({
          params: { index: 0 },
          body: { name: 'Updated', url: 'https://updated.com', description: 'Updated desc' },
        } as any);

        expect(response).toEqual({ status: 200, body: updated });
        expect(mockSettingCoreService.updateFriendLink).toHaveBeenCalledWith(0, {
          name: 'Updated',
          url: 'https://updated.com',
          description: 'Updated desc',
        });
      });
    });

    describe('deleteFriendLink', () => {
      it('should call service with index from params', async () => {
        const remaining: FriendLink[] = [];
        mockSettingCoreService.deleteFriendLink.mockResolvedValue(remaining);

        const handler = controller.deleteFriendLink();
        const response = await handler({ params: { index: 0 } } as any);

        expect(response).toEqual({ status: 200, body: remaining });
        expect(mockSettingCoreService.deleteFriendLink).toHaveBeenCalledWith(0);
      });
    });

    describe('getNavigation', () => {
      it('should call service and return formatted response', async () => {
        const mockNav: Navigation[] = [
          { name: 'Home', path: '/', external: false },
          { name: 'About', path: '/about', external: false },
        ];
        mockSettingCoreService.getNavigation.mockResolvedValue(mockNav);

        const handler = controller.getNavigation();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockNav });
      });
    });

    describe('updateNavigation', () => {
      it('should map NavigationItem to Navigation and call service', async () => {
        const updated: Navigation[] = [
          { name: 'Home', path: '/', icon: undefined, external: false, children: undefined },
        ];
        mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

        const handler = controller.updateNavigation();
        const response = await handler({
          body: {
            items: [{ name: 'Home', path: '/', external: false }],
          },
        } as any);

        expect(response).toEqual({ status: 200, body: updated });
        expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([
          { name: 'Home', path: '/', icon: undefined, external: false, children: undefined },
        ]);
      });

      it('should handle external links correctly', async () => {
        const updated: Navigation[] = [
          { name: 'External', path: 'https://example.com', external: true },
        ];
        mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

        const handler = controller.updateNavigation();
        await handler({
          body: {
            items: [{ name: 'External', path: 'https://example.com', external: true }],
          },
        } as any);

        expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([
          {
            name: 'External',
            path: 'https://example.com',
            icon: undefined,
            external: true,
            children: undefined,
          },
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

        const handler = controller.updateNavigation();
        await handler({
          body: {
            items: [
              {
                name: 'Root',
                path: '/',
                external: false,
                children: [{ name: 'Child', path: '/child', external: false }],
              },
            ],
          },
        } as any);

        expect(mockSettingCoreService.updateNavigation).toHaveBeenCalled();
        const [[callArg]] = mockSettingCoreService.updateNavigation.mock.calls;
        expect(callArg[0].children).toBeDefined();
        expect(callArg[0].children[0].name).toBe('Child');
      });

      it('should handle navigation items without children', async () => {
        const updated: Navigation[] = [
          { name: 'Home', path: '/', icon: undefined, external: false, children: undefined },
        ];
        mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

        const handler = controller.updateNavigation();
        await handler({
          body: {
            items: [{ name: 'Home', path: '/', external: false }],
          },
        } as any);

        expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([
          { name: 'Home', path: '/', icon: undefined, external: false, children: undefined },
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

        const handler = controller.updateNavigation();
        await handler({
          body: {
            items: [{ name: 'Home', path: '/', icon: 'home-icon', external: false }],
          },
        } as any);

        expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([
          { name: 'Home', path: '/', icon: 'home-icon', external: false, children: undefined },
        ]);
      });

      it('should handle empty navigation items array', async () => {
        const updated: Navigation[] = [];
        mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

        const handler = controller.updateNavigation();
        await handler({
          body: { items: [] },
        } as any);

        expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([]);
      });
    });

    describe('getCustomCode', () => {
      it('should call service and return formatted response', async () => {
        const mockCode: CustomCode = {
          head: '<meta>',
          script: '<script>',
          html: '<div>',
        };
        mockSettingCoreService.getCustomCode.mockResolvedValue(mockCode);

        const handler = controller.getCustomCode();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockCode });
      });
    });

    describe('updateCustomCode', () => {
      it('should call service with body and return formatted response', async () => {
        const updated: CustomCode = {
          head: '<meta name="updated">',
          script: '<script>updated</script>',
          html: '<div>updated</div>',
        };
        mockSettingCoreService.updateCustomCode.mockResolvedValue(updated);

        const handler = controller.updateCustomCode();
        const response = await handler({ body: updated } as any);

        expect(response).toEqual({ status: 200, body: updated });
        expect(mockSettingCoreService.updateCustomCode).toHaveBeenCalledWith(updated);
      });
    });

    describe('getAboutInfo', () => {
      it('should call service and return formatted response', async () => {
        const mockAbout: AboutInfo = {
          content: 'About me',
          updatedAt: dayjs().format(),
        };
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAbout);

        const handler = controller.getAboutInfo();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockAbout });
      });
    });

    describe('updateAboutInfo', () => {
      it('should call service with body and return formatted response', async () => {
        const updated: AboutInfo = {
          content: 'Updated about',
          updatedAt: dayjs().format(),
        };
        mockSettingCoreService.updateAboutInfo.mockResolvedValue(updated);

        const handler = controller.updateAboutInfo();
        const response = await handler({ body: { content: 'Updated about' } } as any);

        expect(response).toEqual({ status: 200, body: updated });
        expect(mockSettingCoreService.updateAboutInfo).toHaveBeenCalledWith({
          content: 'Updated about',
        });
      });
    });
  });
});
