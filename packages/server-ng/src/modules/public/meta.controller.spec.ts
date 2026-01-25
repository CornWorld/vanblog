import { Test, type TestingModule } from '@nestjs/testing';

import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

import { BootstrapService } from './bootstrap.service';
import { MetaController } from './meta.controller';

describe('MetaController', () => {
  let controller: MetaController;

  const mockBootstrapService = {
    getPublicBootstrap: vi.fn(),
  };

  const mockHookService = {
    applyFilters: vi.fn(),
  };

  const mockSettingCoreService = {
    getAboutInfo: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetaController],
      providers: [
        { provide: BootstrapService, useValue: mockBootstrapService },
        { provide: HookService, useValue: mockHookService as any },
        { provide: SettingCoreService, useValue: mockSettingCoreService },
      ],
    }).compile();

    controller = module.get<MetaController>(MetaController);
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMeta', () => {
    it('should wrap data with {statusCode:200,data} and include about, transformed links/rewards/menus, and pass through filters', async () => {
      const mockBoot = {
        version: '1.0.0',
        tags: ['t1', 't2'],
        totalArticles: 2,
        totalWordCount: 1234,
        siteInfo: { title: 'Site' },
        friendLinks: [{ name: 'A', description: 'desc', avatar: 'logo', url: 'https://a.test' }],
        categories: ['c1', 'c2'],
        navigation: [{ name: 'Home', value: '/', children: [{ name: 'Blog', value: '/blog' }] }],
        extensions: {
          rewards: [{ name: 'r1', value: 'v1' }],
        },
      } as any;

      mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBoot);
      mockSettingCoreService.getAboutInfo.mockResolvedValue({
        content: 'about content',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
      mockHookService.applyFilters.mockImplementation((_hook, data) => data);

      const res = await controller.getMeta();

      expect(res.statusCode).toBe(200);
      const data = res.data as any;

      expect(data.version).toBe('1.0.0');
      expect(data.tags).toEqual(['t1', 't2']);
      expect(data.totalArticles).toBe(2);
      expect(data.totalWordCount).toBe(1234);
      expect(data.meta.siteInfo).toEqual({ title: 'Site' });

      expect(data.meta.about).toEqual({
        content: 'about content',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });

      expect(Array.isArray(data.meta.links)).toBe(true);
      expect(data.meta.links[0]).toMatchObject({ name: 'A', url: 'https://a.test' });
      expect(typeof data.meta.links[0].updatedAt).toBe('string');

      // rewards have been removed from direct fields and moved to extensions

      // navigation: 1 parent + 1 child => flattened to 2 menus
      expect(Array.isArray(data.menus)).toBe(true);
      expect(data.menus.length).toBe(2);

      expect(mockHookService.applyFilters).toHaveBeenCalled();
    });

    it('should fallback to original data when filters throw', async () => {
      const mockBoot = {
        version: '1.0.0',
        tags: [],
        totalArticles: 0,
        totalWordCount: 0,
        siteInfo: {},
        friendLinks: [],
        extensions: {},
        categories: [],
        navigation: [],
      } as any;

      mockBootstrapService.getPublicBootstrap.mockResolvedValue(mockBoot);
      mockSettingCoreService.getAboutInfo.mockResolvedValue({
        content: '',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
      mockHookService.applyFilters.mockRejectedValue(new Error('boom'));

      const res = await controller.getMeta();

      expect(res.statusCode).toBe(200);
      expect(res.data.meta.about).toEqual({
        content: '',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
    });
  });
});
