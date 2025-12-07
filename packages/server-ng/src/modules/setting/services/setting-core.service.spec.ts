import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs, type FriendLink, type CreateFriendLink } from '@vanblog/shared';
import { z } from 'zod';

import { DATABASE_CONNECTION } from '../../../database';
import { HookService } from '../../plugin/services/hook.service';

import {
  SettingCoreService,
  type SiteInfo,
  type Navigation,
  type CustomCode,
} from './setting-core.service';
import { SettingRegistryService } from './setting-registry.service';

describe('SettingCoreService', () => {
  let service: SettingCoreService;
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockHookService: {
    applyFilters: ReturnType<typeof vi.fn>;
    doAction: ReturnType<typeof vi.fn>;
  };
  let mockRegistryService: {
    updateConfig: ReturnType<typeof vi.fn>;
  };

  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn(),
  };

  const mockUpdateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn(),
  };

  beforeEach(async () => {
    mockDb = {
      select: vi.fn().mockReturnValue(mockSelectChain),
      insert: vi.fn().mockReturnValue(mockInsertChain),
      update: vi.fn().mockReturnValue(mockUpdateChain),
      delete: vi.fn(),
    };

    mockHookService = {
      applyFilters: vi.fn(),
      doAction: vi.fn(),
    };

    mockRegistryService = {
      updateConfig: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingCoreService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
        {
          provide: SettingRegistryService,
          useValue: mockRegistryService,
        },
      ],
    }).compile();

    service = module.get<SettingCoreService>(SettingCoreService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return existing config value', async () => {
      const mockValue = { test: 'value' };
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(mockValue) }]);

      const result = await service.getConfig('testKey');

      expect(result).toEqual(mockValue);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return default value when config not found', async () => {
      const defaultValue = { default: 'test' };
      mockSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(defaultValue);

      const result = await service.getConfig('testKey', defaultValue);

      expect(result).toEqual(defaultValue);
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith('testKey', defaultValue);
    });

    it('should return null when no config and no default', async () => {
      mockSelectChain.limit.mockResolvedValue([]);

      const result = await service.getConfig('testKey');

      expect(result).toBeNull();
    });

    it('should parse with provided schema and return typed value', async () => {
      const schema = z.object({ a: z.string(), b: z.number() });
      const stored = { a: 'x', b: 1 };
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(stored) }]);

      const result = await service.getConfig<typeof stored>('schemaKey', undefined, schema);

      expect(result).toEqual(stored);
    });

    it('should return null if schema parsing fails', async () => {
      const schema = z.object({ a: z.string(), b: z.number() });
      const badStored = { a: 'x', b: 'not-number' } as any;
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(badStored) }]);

      const result = await service.getConfig('schemaKey', undefined, schema);

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should update existing config', async () => {
      const testValue = { updated: 'value' };
      const filteredData = { key: 'testKey', value: testValue };

      mockHookService.applyFilters.mockResolvedValue(filteredData);
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify({ old: 'value' }) }]);
      mockRegistryService.updateConfig.mockResolvedValue(testValue);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateConfig('testKey', testValue);

      expect(result).toEqual(testValue);
      expect(mockHookService.applyFilters).toHaveBeenCalledWith('setting|beforeUpdate', {
        key: 'testKey',
        value: testValue,
      });
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith('testKey', testValue);
      expect(mockHookService.doAction).toHaveBeenCalledTimes(2);
    });

    it('should create new config when not exists', async () => {
      const testValue = { new: 'value' };
      const filteredData = { key: 'testKey', value: testValue };

      mockHookService.applyFilters.mockResolvedValue(filteredData);
      mockSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(testValue);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateConfig('testKey', testValue);

      expect(result).toEqual(testValue);
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith('testKey', testValue);
    });

    it('should call doAction with correct payloads including parsed oldValue and updatedAt', async () => {
      const testValue = { updated: 'value' };
      const filteredData = { key: 'testKey', value: testValue };
      const oldStoredRaw = { old: 'value' };

      mockHookService.applyFilters.mockResolvedValue(filteredData);
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(oldStoredRaw) }]);
      mockRegistryService.updateConfig.mockResolvedValue(testValue);
      mockHookService.doAction.mockResolvedValue(undefined);

      await service.updateConfig('testKey', testValue);

      expect(mockHookService.doAction).toHaveBeenCalledWith('setting|afterUpdate', {
        key: 'testKey',
        value: testValue,
        oldValue: JSON.stringify(oldStoredRaw),
      });
      const secondCall = mockHookService.doAction.mock.calls.find(
        (c: any[]) => c[0] === 'setting|afterUpdate',
      );
      expect(secondCall).toBeTruthy();
      if (!secondCall) {
        throw new Error('Expected hook "setting|afterUpdate" to be called');
      }
      const [, payload] = secondCall;
      expect(payload).toMatchObject({ key: 'testKey', value: testValue, oldValue: oldStoredRaw });
      expect(typeof payload.updatedAt).toBe('string');
    });
  });

  describe('getSiteInfo', () => {
    it('should return site info with defaults', async () => {
      mockSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);

      const result = await service.getSiteInfo();

      expect(result).toEqual({
        title: 'My Blog',
        description: 'A modern blog platform',
        author: 'Admin',
        keywords: ['blog', 'tech', 'personal'],
      });
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith('siteInfo', {
        title: 'My Blog',
        description: 'A modern blog platform',
        author: 'Admin',
        keywords: ['blog', 'tech', 'personal'],
      });
    });

    it('should return existing site info', async () => {
      const existingInfo: SiteInfo = {
        title: 'Custom Blog',
        description: 'Custom description',
        author: 'Custom Author',
        keywords: ['custom'],
      };
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(existingInfo) }]);

      const result = await service.getSiteInfo();

      expect(result).toEqual(existingInfo);
    });
  });

  describe('updateSiteInfo', () => {
    it('should update site info', async () => {
      const existingInfo: SiteInfo = {
        title: 'Old Title',
        description: 'Old description',
        author: 'Old Author',
        keywords: ['old'],
      };
      const updateDto = { title: 'New Title' };
      const expectedResult = { ...existingInfo, ...updateDto };

      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(existingInfo) }]);
      mockHookService.applyFilters.mockResolvedValue({ key: 'siteInfo', value: expectedResult });
      mockRegistryService.updateConfig.mockResolvedValue(expectedResult);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateSiteInfo(updateDto);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('getLayoutSettings', () => {
    it('should return layout settings with defaults', async () => {
      mockSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);

      const result = await service.getLayoutSettings();

      expect(result).toEqual({
        showRecentPosts: true,
        recentPostsCount: 5,
        showCategories: true,
        showTags: true,
        showArchive: true,
        showAbout: true,
        showSearch: true,
      });
    });
  });

  describe('getThemeSettings', () => {
    it('should return theme settings with defaults', async () => {
      mockSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);

      const result = await service.getThemeSettings();

      expect(result).toEqual({
        primaryColor: '#007BFF',
        darkMode: false,
      });
    });
  });

  describe('getNavigation', () => {
    it('should return navigation with defaults', async () => {
      mockSelectChain.limit.mockResolvedValue([]);

      const result = await service.getNavigation();

      expect(result).toEqual([
        { name: 'Home', path: '/' },
        { name: 'Archive', path: '/archive' },
        { name: 'About', path: '/about' },
      ]);
    });
  });

  describe('updateNavigation', () => {
    it('should throw error for invalid navigation data', async () => {
      const invalidNavigation = [{ name: '', path: '' }] as Navigation[];

      await expect(service.updateNavigation(invalidNavigation)).rejects.toThrow(
        'Invalid navigation data:',
      );
    });

    it('should update navigation when data is valid', async () => {
      const validNav: Navigation[] = [
        { name: 'Home', path: '/', external: false },
        {
          name: 'Docs',
          path: '/docs',
          external: false,
          children: [{ name: 'Guide', path: '/docs/guide', external: false }],
        },
      ];

      const spy = vi.spyOn(service as any, 'updateConfig').mockResolvedValue(validNav as any);

      const result = await service.updateNavigation(validNav);

      expect(result).toEqual(validNav);
      expect(spy).toHaveBeenCalledWith('navigation', expect.any(Array));
      const passed = spy.mock.calls[0][1] as any[];
      expect(passed[1].children?.length).toBe(1);
    });
  });

  describe('getFriendLinks', () => {
    it('should return empty array when no friend links', async () => {
      mockSelectChain.limit.mockResolvedValue([]);

      const result = await service.getFriendLinks();

      expect(result).toEqual([]);
    });
  });

  describe('createFriendLink', () => {
    it('should add new friend link', async () => {
      const newLinkInput: CreateFriendLink = {
        name: 'Test Friend',
        url: 'https://test.com',
        description: 'Test description',
      };

      const expectedLink: FriendLink = {
        id: 1,
        name: 'Test Friend',
        url: 'https://test.com',
        description: 'Test description',
        createTime: expect.any(String),
        updateTime: expect.any(String),
      };

      mockSelectChain.limit.mockResolvedValue([]);
      mockHookService.applyFilters.mockResolvedValue({ key: 'friendLinks', value: [expectedLink] });
      mockRegistryService.updateConfig.mockResolvedValue([expectedLink]);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.createFriendLink(newLinkInput);

      expect(result).toMatchObject({
        id: 1,
        name: 'Test Friend',
        url: 'https://test.com',
        description: 'Test description',
      });
      expect(result.createTime).toBeDefined();
      expect(result.updateTime).toBeDefined();
    });
  });

  describe('updateFriendLink', () => {
    it('should update existing friend link', async () => {
      const existingLinks: FriendLink[] = [
        {
          id: 1,
          name: 'Friend 1',
          url: 'https://friend1.com',
          createTime: '2024-01-01T00:00:00Z',
          updateTime: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'Friend 2',
          url: 'https://friend2.com',
          createTime: '2024-01-01T00:00:00Z',
          updateTime: '2024-01-01T00:00:00Z',
        },
      ];
      const updateDto = { name: 'Updated Friend 1' };

      // Mock getFriendLinks to return existing links
      vi.spyOn(service, 'getFriendLinks').mockResolvedValue(existingLinks);
      mockHookService.applyFilters.mockImplementation(async (_hook, data) => data);
      mockRegistryService.updateConfig.mockImplementation(async (_key, value) => value);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateFriendLink(0, updateDto);

      expect(result.name).toBe('Updated Friend 1');
      expect(result.id).toBe(1);
      expect(result.updateTime).toBeDefined();
    });

    it('should throw error for invalid index', async () => {
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify([]) }]);

      await expect(service.updateFriendLink(0, { name: 'Test' })).rejects.toThrow('Invalid index');
    });
  });

  describe('deleteFriendLink', () => {
    it('should delete friend link at index', async () => {
      const existingLinks: FriendLink[] = [
        {
          id: 1,
          name: 'Friend 1',
          url: 'https://friend1.com',
          createTime: '2024-01-01T00:00:00Z',
          updateTime: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'Friend 2',
          url: 'https://friend2.com',
          createTime: '2024-01-01T00:00:00Z',
          updateTime: '2024-01-01T00:00:00Z',
        },
      ];
      const expectedResult = [existingLinks[1]];

      // Mock getFriendLinks to return existing links
      vi.spyOn(service, 'getFriendLinks').mockResolvedValue(existingLinks);
      mockHookService.applyFilters.mockResolvedValue({ key: 'friendLinks', value: expectedResult });
      mockRegistryService.updateConfig.mockResolvedValue(expectedResult);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.deleteFriendLink(0);

      expect(result).toEqual(expectedResult);
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith('friendLinks', expectedResult);
    });

    it('should throw error for invalid index', async () => {
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify([]) }]);

      await expect(service.deleteFriendLink(0)).rejects.toThrow('Invalid index');
    });
  });

  describe('getCustomCode', () => {
    it('should return empty object when no custom code', async () => {
      mockSelectChain.limit.mockResolvedValue([]);

      const result = await service.getCustomCode();

      expect(result).toEqual({
        css: '',
        script: '',
        html: '',
        head: '',
      });
    });

    it('should return existing custom code', async () => {
      const existingCode: CustomCode = {
        head: '<meta name="test" content="test">',
        css: 'body { color: red; }',
        script: 'console.log("test")',
        html: '<div>test</div>',
      };
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(existingCode) }]);

      const result = await service.getCustomCode();

      expect(result).toEqual(existingCode);
    });
  });

  describe('updateCustomCode', () => {
    it('should update custom code', async () => {
      const existingCode: CustomCode = {
        head: '<meta name="old" content="old">',
      };
      const updateDto = { script: 'console.log("new")' };
      const expectedResult = { ...existingCode, ...updateDto };

      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(existingCode) }]);
      mockHookService.applyFilters.mockResolvedValue({ key: 'customCode', value: expectedResult });
      mockRegistryService.updateConfig.mockResolvedValue(expectedResult);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateCustomCode(updateDto);

      expect(result).toEqual(expectedResult);
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith('customCode', expectedResult);
    });
  });

  describe('getAboutInfo', () => {
    it('should return default about info when not set and persist default', async () => {
      mockSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);

      const result = await service.getAboutInfo();

      expect(result.content).toBe('');
      expect(typeof result.updatedAt).toBe('string');
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith(
        'aboutInfo',
        expect.any(Object),
      );
    });

    it('should return existing about info', async () => {
      const existing = { content: 'Hello', updatedAt: dayjs().format() };
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(existing) }]);

      const result = await service.getAboutInfo();

      expect(result).toEqual(existing);
    });
  });

  describe('updateAboutInfo', () => {
    it('should update about content and timestamp', async () => {
      const existing = { content: 'Old', updatedAt: '2020-01-01T00:00:00.000Z' };
      mockSelectChain.limit.mockResolvedValueOnce([{ value: JSON.stringify(existing) }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateAboutInfo({ content: 'New Content' });

      expect(result.content).toBe('New Content');
      expect(typeof result.updatedAt).toBe('string');
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith(
        'aboutInfo',
        expect.any(Object),
      );
    });
  });
});
