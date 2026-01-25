import { BadRequestException } from '@nestjs/common';
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
          id: 1,
          name: 'Friend 1',
          url: 'https://friend1.com',
          description: 'Friend 1 description',
          createTime: '2024-01-01T00:00:00Z',
          updateTime: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'Friend 2',
          url: 'https://friend2.com',
          description: 'Friend 2 description',
          createTime: '2024-01-01T00:00:00Z',
          updateTime: '2024-01-01T00:00:00Z',
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
      const createdFriendLink: FriendLink = {
        id: 1,
        name: 'New Friend',
        url: 'https://newfriend.com',
        description: 'New friend description',
        createTime: '2024-01-01T00:00:00Z',
        updateTime: '2024-01-01T00:00:00Z',
      };

      mockSettingCoreService.createFriendLink.mockResolvedValue(createdFriendLink);

      const result = await controller.createFriendLink(createDto);

      expect(result).toEqual(createdFriendLink);
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
      const updatedFriendLink: FriendLink = {
        id: 1,
        name: 'Updated Friend',
        url: 'https://updatedfriend.com',
        description: 'Updated description',
        createTime: '2024-01-01T00:00:00Z',
        updateTime: '2024-01-02T00:00:00Z',
      };

      mockSettingCoreService.updateFriendLink.mockResolvedValue(updatedFriendLink);

      const result = await controller.updateFriendLink(index, updateDto);

      expect(result).toEqual(updatedFriendLink);
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
        script: '<script>console.log("test")</script>',
        html: '<div>Footer content</div>',
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
        script: '<script>console.log("updated")</script>',
      };
      const updatedCustomCode: CustomCode = {
        head: '<meta name="updated" content="test">',
        script: '<script>console.log("updated")</script>',
        html: '<div>Footer content</div>',
      };

      mockSettingCoreService.updateCustomCode.mockResolvedValue(updatedCustomCode);

      const result = await controller.updateCustomCode(updateDto);

      expect(result).toEqual(updatedCustomCode);
      expect(mockSettingCoreService.updateCustomCode).toHaveBeenCalledWith(updateDto);
    });
  });

  // About
  describe('getAboutInfo', () => {
    it('should return about info', async () => {
      const mockAbout = { content: 'Hello', updatedAt: dayjs().format() };
      mockSettingCoreService.getAboutInfo = vi.fn().mockResolvedValue(mockAbout);

      const result = await controller.getAboutInfo();

      expect(result).toEqual(mockAbout);
      expect(mockSettingCoreService.getAboutInfo).toHaveBeenCalled();
    });
  });

  describe('updateAboutInfo', () => {
    it('should update about info', async () => {
      const updateDto = { content: 'New Hello' } as any;
      const updated = { content: 'New Hello', updatedAt: dayjs().format() };
      mockSettingCoreService.updateAboutInfo = vi.fn().mockResolvedValue(updated);

      const result = await controller.updateAboutInfo(updateDto);

      expect(result).toEqual(updated);
      expect(mockSettingCoreService.updateAboutInfo).toHaveBeenCalledWith(updateDto);
    });
  });

  // Validation Tests
  describe('validation errors', () => {
    describe('updateSiteInfo validation', () => {
      it('should throw BadRequestException when siteName is empty', async () => {
        const invalidDto = { siteName: '' };

        await expect(controller.updateSiteInfo(invalidDto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when siteName is missing', async () => {
        const invalidDto = {};

        await expect(controller.updateSiteInfo(invalidDto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException with validation details', async () => {
        const invalidDto = { siteName: '' };

        try {
          await controller.updateSiteInfo(invalidDto);
          expect.fail('Should have thrown BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          expect((error as any).response.message).toBe('Validation failed');
          expect((error as any).response.issues).toBeDefined();
        }
      });
    });

    describe('updateLayoutSettings validation', () => {
      it('should throw BadRequestException for invalid layout data', async () => {
        const invalidDto = { showRecentPosts: 'not a boolean' };

        await expect(controller.updateLayoutSettings(invalidDto)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('updateThemeSettings validation', () => {
      it('should throw BadRequestException for invalid theme data', async () => {
        const invalidDto = { theme: 123 };

        await expect(controller.updateThemeSettings(invalidDto)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('createFriendLink validation', () => {
      it('should throw BadRequestException when name is empty', async () => {
        const invalidDto = { name: '', url: 'https://example.com' };

        await expect(controller.createFriendLink(invalidDto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when url is invalid', async () => {
        const invalidDto = { name: 'Friend', url: 'not-a-url' };

        await expect(controller.createFriendLink(invalidDto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when avatar is invalid URL', async () => {
        const invalidDto = {
          name: 'Friend',
          url: 'https://example.com',
          avatar: 'invalid-url',
        };

        await expect(controller.createFriendLink(invalidDto)).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateFriendLink validation', () => {
      it('should throw BadRequestException for invalid data', async () => {
        const invalidDto = { name: '', url: 'https://example.com' };

        await expect(controller.updateFriendLink(0, invalidDto)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('updateNavigation validation', () => {
      it('should throw BadRequestException when navigation name is empty', async () => {
        const invalidDto = {
          items: [{ name: '', url: '/', target: '_self', order: 0 }],
        };

        await expect(controller.updateNavigation(invalidDto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when navigation url is empty', async () => {
        const invalidDto = {
          items: [{ name: 'Home', url: '', target: '_self', order: 0 }],
        };

        await expect(controller.updateNavigation(invalidDto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for invalid target value', async () => {
        const invalidDto = {
          items: [{ name: 'Home', url: '/', target: 'invalid', order: 0 }],
        };

        await expect(controller.updateNavigation(invalidDto)).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateCustomCode validation', () => {
      it('should throw BadRequestException for invalid custom code data', async () => {
        const invalidDto = { head: 123 };

        await expect(controller.updateCustomCode(invalidDto)).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateAboutInfo validation', () => {
      it('should throw BadRequestException for invalid about data', async () => {
        const invalidDto = { content: 123 };

        await expect(controller.updateAboutInfo(invalidDto)).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ts-rest handlers tests
  describe('ts-rest handlers', () => {
    describe('getSiteInfo_tsrest', () => {
      it('should return ts-rest handler function', () => {
        const handler = controller.getSiteInfo_tsrest();
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

        const handler = controller.getSiteInfo_tsrest();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockSiteInfo });
        expect(mockSettingCoreService.getSiteInfo).toHaveBeenCalled();
      });
    });

    describe('updateSiteInfo_tsrest', () => {
      it('should return ts-rest handler function', () => {
        const handler = controller.updateSiteInfo_tsrest();
        expect(handler).toBeDefined();
        expect(typeof handler).toBe('function');
      });

      it('should call service with mapped data and return formatted response', async () => {
        const updatedSiteInfo: SiteInfo = {
          title: 'Updated Blog',
          description: 'Updated Description',
          keywords: ['test'],
          author: 'Test Author',
        };
        mockSettingCoreService.updateSiteInfo.mockResolvedValue(updatedSiteInfo);

        const handler = controller.updateSiteInfo_tsrest();
        const response = await handler({
          body: {
            siteName: 'Updated Blog',
            siteDescription: 'Updated Description',
            siteKeywords: 'test',
          },
        } as any);

        expect(response).toEqual({ status: 200, body: updatedSiteInfo });
        expect(mockSettingCoreService.updateSiteInfo).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Updated Blog',
            description: 'Updated Description',
            keywords: ['test'],
          }),
        );
      });

      it('should handle keywords splitting correctly', async () => {
        const updatedSiteInfo: SiteInfo = {
          title: 'Blog',
          description: 'Desc',
          keywords: ['a', 'b', 'c'],
          author: 'Author',
        };
        mockSettingCoreService.updateSiteInfo.mockResolvedValue(updatedSiteInfo);

        const handler = controller.updateSiteInfo_tsrest();
        await handler({
          body: {
            siteName: 'Blog',
            siteDescription: 'Desc',
            siteKeywords: 'a, b ,c',
            authorName: 'Author',
          },
        } as any);

        expect(mockSettingCoreService.updateSiteInfo).toHaveBeenCalledWith(
          expect.objectContaining({
            keywords: ['a', 'b', 'c'],
          }),
        );
      });
    });

    describe('getLayoutSettings_tsrest', () => {
      it('should return ts-rest handler function', () => {
        const handler = controller.getLayoutSettings_tsrest();
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

        const handler = controller.getLayoutSettings_tsrest();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockLayout });
      });
    });

    describe('updateLayoutSettings_tsrest', () => {
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

        const handler = controller.updateLayoutSettings_tsrest();
        const response = await handler({ body: updatedLayout } as any);

        expect(response).toEqual({ status: 200, body: updatedLayout });
        expect(mockSettingCoreService.updateLayoutSettings).toHaveBeenCalledWith(updatedLayout);
      });
    });

    describe('getThemeSettings_tsrest', () => {
      it('should call service and return formatted response', async () => {
        const mockTheme: SiteTheme = {
          primaryColor: '#007bff',
          darkMode: false,
        };
        mockSettingCoreService.getThemeSettings.mockResolvedValue(mockTheme);

        const handler = controller.getThemeSettings_tsrest();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockTheme });
      });
    });

    describe('updateThemeSettings_tsrest', () => {
      it('should map theme color and call service', async () => {
        const updatedTheme: SiteTheme = {
          primaryColor: '#ff0000',
          darkMode: false,
        };
        mockSettingCoreService.updateThemeSettings.mockResolvedValue(updatedTheme);

        const handler = controller.updateThemeSettings_tsrest();
        const response = await handler({ body: { theme: '#ff0000' } } as any);

        expect(response).toEqual({ status: 200, body: updatedTheme });
        expect(mockSettingCoreService.updateThemeSettings).toHaveBeenCalledWith({
          primaryColor: '#ff0000',
          darkMode: false,
        });
      });

      it('should use default color when theme is empty', async () => {
        const updatedTheme: SiteTheme = {
          primaryColor: '#000000',
          darkMode: false,
        };
        mockSettingCoreService.updateThemeSettings.mockResolvedValue(updatedTheme);

        const handler = controller.updateThemeSettings_tsrest();
        await handler({ body: { theme: '' } } as any);

        expect(mockSettingCoreService.updateThemeSettings).toHaveBeenCalledWith({
          primaryColor: '#000000',
          darkMode: false,
        });
      });
    });

    describe('getFriendLinks_tsrest', () => {
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

        const handler = controller.getFriendLinks_tsrest();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockLinks });
      });
    });

    describe('createFriendLink_tsrest', () => {
      it('should call service with mapped data and return 201', async () => {
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

        const handler = controller.createFriendLink_tsrest();
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

    describe('updateFriendLink_tsrest', () => {
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

        const handler = controller.updateFriendLink_tsrest();
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

    describe('deleteFriendLink_tsrest', () => {
      it('should call service with index from params', async () => {
        const remaining: FriendLink[] = [];
        mockSettingCoreService.deleteFriendLink.mockResolvedValue(remaining);

        const handler = controller.deleteFriendLink_tsrest();
        const response = await handler({ params: { index: 0 } } as any);

        expect(response).toEqual({ status: 200, body: remaining });
        expect(mockSettingCoreService.deleteFriendLink).toHaveBeenCalledWith(0);
      });
    });

    describe('getNavigation_tsrest', () => {
      it('should call service and return formatted response', async () => {
        const mockNav: Navigation[] = [
          { name: 'Home', path: '/', external: false },
          { name: 'About', path: '/about', external: false },
        ];
        mockSettingCoreService.getNavigation.mockResolvedValue(mockNav);

        const handler = controller.getNavigation_tsrest();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockNav });
      });
    });

    describe('updateNavigation_tsrest', () => {
      it('should map NavigationItem to Navigation and call service', async () => {
        const updated: Navigation[] = [
          { name: 'Home', path: '/', icon: undefined, external: false, children: undefined },
        ];
        mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

        const handler = controller.updateNavigation_tsrest();
        const response = await handler({
          body: {
            items: [{ name: 'Home', url: '/', target: '_self', order: 0 }],
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

        const handler = controller.updateNavigation_tsrest();
        await handler({
          body: {
            items: [{ name: 'External', url: 'https://example.com', target: '_blank', order: 0 }],
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

        const handler = controller.updateNavigation_tsrest();
        await handler({
          body: {
            items: [
              {
                name: 'Root',
                url: '/',
                target: '_self',
                order: 0,
                children: [{ name: 'Child', url: '/child', target: '_self', order: 0 }],
              },
            ],
          },
        } as any);

        expect(mockSettingCoreService.updateNavigation).toHaveBeenCalled();
        const [[callArg]] = mockSettingCoreService.updateNavigation.mock.calls;
        expect(callArg[0].children).toBeDefined();
        expect(callArg[0].children[0].name).toBe('Child');
      });
    });

    describe('getCustomCode_tsrest', () => {
      it('should call service and return formatted response', async () => {
        const mockCode: CustomCode = {
          head: '<meta>',
          script: '<script>',
          html: '<div>',
        };
        mockSettingCoreService.getCustomCode.mockResolvedValue(mockCode);

        const handler = controller.getCustomCode_tsrest();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockCode });
      });
    });

    describe('updateCustomCode_tsrest', () => {
      it('should call service with body and return formatted response', async () => {
        const updated: CustomCode = {
          head: '<meta name="updated">',
          script: '<script>updated</script>',
          html: '<div>updated</div>',
        };
        mockSettingCoreService.updateCustomCode.mockResolvedValue(updated);

        const handler = controller.updateCustomCode_tsrest();
        const response = await handler({ body: updated } as any);

        expect(response).toEqual({ status: 200, body: updated });
        expect(mockSettingCoreService.updateCustomCode).toHaveBeenCalledWith(updated);
      });
    });

    describe('getAboutInfo_tsrest', () => {
      it('should call service and return formatted response', async () => {
        const mockAbout: AboutInfo = {
          content: 'About me',
          updatedAt: dayjs().format(),
        };
        mockSettingCoreService.getAboutInfo.mockResolvedValue(mockAbout);

        const handler = controller.getAboutInfo_tsrest();
        const response = await handler({} as any);

        expect(response).toEqual({ status: 200, body: mockAbout });
      });
    });

    describe('updateAboutInfo_tsrest', () => {
      it('should call service with body and return formatted response', async () => {
        const updated: AboutInfo = {
          content: 'Updated about',
          updatedAt: dayjs().format(),
        };
        mockSettingCoreService.updateAboutInfo.mockResolvedValue(updated);

        const handler = controller.updateAboutInfo_tsrest();
        const response = await handler({ body: { content: 'Updated about' } } as any);

        expect(response).toEqual({ status: 200, body: updated });
        expect(mockSettingCoreService.updateAboutInfo).toHaveBeenCalledWith({
          content: 'Updated about',
        });
      });
    });
  });

  // Edge cases and error handling
  describe('edge cases', () => {
    describe('updateSiteInfo edge cases', () => {
      it('should handle missing keywords', async () => {
        const updatedSiteInfo: SiteInfo = {
          title: 'Blog',
          description: '',
          keywords: [],
          author: '',
        };
        mockSettingCoreService.updateSiteInfo.mockResolvedValue(updatedSiteInfo);

        await controller.updateSiteInfo({ siteName: 'Blog' });

        expect(mockSettingCoreService.updateSiteInfo).toHaveBeenCalledWith({
          title: 'Blog',
          description: '',
          author: '',
          keywords: [],
        });
      });

      it('should trim whitespace from keywords', async () => {
        const updatedSiteInfo: SiteInfo = {
          title: 'Blog',
          description: '',
          keywords: ['a', 'b', 'c'],
          author: '',
        };
        mockSettingCoreService.updateSiteInfo.mockResolvedValue(updatedSiteInfo);

        await controller.updateSiteInfo({ siteName: 'Blog', siteKeywords: '  a  ,  b  ,  c  ' });

        expect(mockSettingCoreService.updateSiteInfo).toHaveBeenCalledWith(
          expect.objectContaining({
            keywords: ['a', 'b', 'c'],
          }),
        );
      });

      it('should handle undefined optional fields', async () => {
        const updatedSiteInfo: SiteInfo = {
          title: 'Blog',
          description: '',
          keywords: [],
          author: '',
        };
        mockSettingCoreService.updateSiteInfo.mockResolvedValue(updatedSiteInfo);

        await controller.updateSiteInfo({
          siteName: 'Blog',
          siteDescription: undefined,
          authorName: undefined,
        });

        expect(mockSettingCoreService.updateSiteInfo).toHaveBeenCalledWith({
          title: 'Blog',
          description: '',
          author: '',
          keywords: [],
        });
      });
    });

    describe('updateThemeSettings edge cases', () => {
      it('should pass through valid theme string', async () => {
        const updatedTheme: SiteTheme = {
          primaryColor: '#123456',
          darkMode: false,
        };
        mockSettingCoreService.updateThemeSettings.mockResolvedValue(updatedTheme);

        await controller.updateThemeSettings({ theme: '#123456', customCss: '' } as any);

        expect(mockSettingCoreService.updateThemeSettings).toHaveBeenCalledWith({
          primaryColor: '#123456',
          darkMode: false,
        });
      });

      it('should use provided theme color when not empty', async () => {
        const updatedTheme: SiteTheme = {
          primaryColor: '#ff0000',
          darkMode: false,
        };
        mockSettingCoreService.updateThemeSettings.mockResolvedValue(updatedTheme);

        await controller.updateThemeSettings({ theme: '#ff0000' });

        expect(mockSettingCoreService.updateThemeSettings).toHaveBeenCalledWith({
          primaryColor: '#ff0000',
          darkMode: false,
        });
      });
    });

    describe('updateNavigation edge cases', () => {
      it('should handle navigation items without children', async () => {
        const updated: Navigation[] = [
          { name: 'Home', path: '/', icon: undefined, external: false, children: undefined },
        ];
        mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

        await controller.updateNavigation({
          items: [{ name: 'Home', url: '/', target: '_self', order: 0 }],
        });

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

        await controller.updateNavigation({
          items: [{ name: 'Home', url: '/', icon: 'home-icon', target: '_self', order: 0 }],
        });

        expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([
          { name: 'Home', path: '/', icon: 'home-icon', external: false, children: undefined },
        ]);
      });

      it('should handle empty navigation items array', async () => {
        const updated: Navigation[] = [];
        mockSettingCoreService.updateNavigation.mockResolvedValue(updated);

        await controller.updateNavigation({ items: [] });

        expect(mockSettingCoreService.updateNavigation).toHaveBeenCalledWith([]);
      });
    });

    describe('createFriendLink edge cases', () => {
      it('should handle friend link without optional fields', async () => {
        const newLink: FriendLink = {
          id: 1,
          name: 'Friend',
          url: 'https://friend.com',
          createTime: '2024-01-01T00:00:00Z',
          updateTime: '2024-01-01T00:00:00Z',
        };
        mockSettingCoreService.createFriendLink.mockResolvedValue(newLink);

        await controller.createFriendLink({ name: 'Friend', url: 'https://friend.com' });

        expect(mockSettingCoreService.createFriendLink).toHaveBeenCalledWith({
          name: 'Friend',
          url: 'https://friend.com',
        });
      });
    });
  });
});
