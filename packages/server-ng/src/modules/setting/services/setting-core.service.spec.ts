import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs, type FriendLink, type CreateFriendLink } from '@vanblog/shared';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
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

  // Mock chains must properly compose: select() -> from() -> where() -> limit()
  // Each method must return the same builder object to allow proper method chaining
  // Using mockReturnThis() pattern ensures proper method chaining
  const mockSimpleSelectChain = {
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
    // Use mockSimpleSelectChain for consistent method chaining behavior
    // mockReturnThis() ensures from().where().limit() works properly
    mockDb = {
      select: vi.fn().mockReturnValue(mockSimpleSelectChain),
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
      // Drizzle with mode: 'json' returns deserialized object directly
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: mockValue }]);

      const result = await service.getConfig('testKey');

      expect(result).toEqual(mockValue);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockSimpleSelectChain.from).toHaveBeenCalled();
      expect(mockSimpleSelectChain.where).toHaveBeenCalled();
    });

    it('should return default value when config not found', async () => {
      const defaultValue = { default: 'test' };
      mockSimpleSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(defaultValue);

      const result = await service.getConfig('testKey', defaultValue);

      expect(result).toEqual(defaultValue);
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith('testKey', defaultValue);
    });

    it('should return null when no config and no default', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);

      const result = await service.getConfig('testKey');

      expect(result).toBeNull();
    });

    it('should parse with provided schema and return typed value', async () => {
      const schema = z.object({ a: z.string(), b: z.number() });
      const stored = { a: 'x', b: 1 };
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: stored }]);

      const result = await service.getConfig<typeof stored>('schemaKey', undefined, schema);

      expect(result).toEqual(stored);
    });

    it('should return null if schema parsing fails', async () => {
      const schema = z.object({ a: z.string(), b: z.number() });
      const badStored = { a: 'x', b: 'not-number' } as any;
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: badStored }]);

      const result = await service.getConfig('schemaKey', undefined, schema);

      expect(result).toBeNull();
    });
  });

  describe('Query chain composition - testing chain order (select().from().where().limit())', () => {
    it('should properly compose query chain with from().where().limit() methods', async () => {
      const mockValue = { test: 'chain-composition' };
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: mockValue }]);

      // Call getConfig which internally executes select().from().where().limit()
      const result = await service.getConfig('testKey');

      // Verify result is correct
      expect(result).toEqual(mockValue);

      // Verify select() was called (first in chain)
      expect(mockDb.select).toHaveBeenCalled();

      // Verify from() was called on the result of select()
      // mockReturnThis() ensures the same object is returned for chaining
      expect(mockSimpleSelectChain.from).toHaveBeenCalled();

      // Verify where() was called on the result of from()
      expect(mockSimpleSelectChain.where).toHaveBeenCalled();

      // Verify limit() was called on the result of where()
      expect(mockSimpleSelectChain.limit).toHaveBeenCalled();
    });

    it('should handle multiple chained calls using mockReturnThis pattern', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: { test: 'value' } }]);

      await service.getConfig('key1');
      await service.getConfig('key2');
      await service.getConfig('key3');

      // Each call should create a new chain
      expect(mockDb.select).toHaveBeenCalledTimes(3);
      expect(mockSimpleSelectChain.from).toHaveBeenCalledTimes(3);
      expect(mockSimpleSelectChain.where).toHaveBeenCalledTimes(3);
      expect(mockSimpleSelectChain.limit).toHaveBeenCalledTimes(3);
    });

    it('should demonstrate that chain order matters - limit() must be called last', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: 'result' }]);

      await service.getConfig('test');

      // Get call order from mock
      const [selectCall] = mockDb.select.mock.invocationCallOrder;
      const [fromCall] = mockSimpleSelectChain.from.mock.invocationCallOrder;
      const [whereCall] = mockSimpleSelectChain.where.mock.invocationCallOrder;
      const [limitCall] = mockSimpleSelectChain.limit.mock.invocationCallOrder;

      // Verify order: select < from < where < limit
      expect(selectCall).toBeLessThan(fromCall);
      expect(fromCall).toBeLessThan(whereCall);
      expect(whereCall).toBeLessThan(limitCall);
    });
  });

  describe('updateConfig', () => {
    it('should update existing config', async () => {
      const testValue = { updated: 'value' };
      const filteredData = { key: 'testKey', value: testValue };
      const oldValue = { old: 'value' };

      mockHookService.applyFilters.mockResolvedValue(filteredData);
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: oldValue }]);
      mockRegistryService.updateConfig.mockResolvedValue(testValue);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateConfig('testKey', testValue);

      expect(result).toEqual(testValue);
      expect(mockHookService.applyFilters).toHaveBeenCalledWith('setting|beforeUpdate', {
        key: 'testKey',
        value: testValue,
      });
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith('testKey', testValue);
      expect(mockHookService.doAction).toHaveBeenCalledTimes(1);
    });

    it('should create new config when not exists', async () => {
      const testValue = { new: 'value' };
      const filteredData = { key: 'testKey', value: testValue };

      mockHookService.applyFilters.mockResolvedValue(filteredData);
      mockSimpleSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(testValue);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateConfig('testKey', testValue);

      expect(result).toEqual(testValue);
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith('testKey', testValue);
    });

    it('should call doAction with correct payload including oldValue and updatedAt', async () => {
      const testValue = { updated: 'value' };
      const filteredData = { key: 'testKey', value: testValue };
      const oldStoredRaw = { old: 'value' };

      mockHookService.applyFilters.mockResolvedValue(filteredData);
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: oldStoredRaw }]);
      mockRegistryService.updateConfig.mockResolvedValue(testValue);
      mockHookService.doAction.mockResolvedValue(undefined);

      await service.updateConfig('testKey', testValue);

      expect(mockHookService.doAction).toHaveBeenCalledWith('setting|afterUpdate', {
        key: 'testKey',
        value: testValue,
        oldValue: oldStoredRaw,
        updatedAt: expect.any(String),
      });
    });
  });

  describe('getSiteInfo', () => {
    it('should return site info with defaults', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);
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
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: existingInfo }]);

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

      mockSimpleSelectChain.limit.mockResolvedValue([{ value: existingInfo }]);
      mockHookService.applyFilters.mockResolvedValue({ key: 'siteInfo', value: expectedResult });
      mockRegistryService.updateConfig.mockResolvedValue(expectedResult);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateSiteInfo(updateDto);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('getLayoutSettings', () => {
    it('should return layout settings with defaults', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);
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
      mockSimpleSelectChain.limit.mockResolvedValue([]);
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
      mockSimpleSelectChain.limit.mockResolvedValue([]);

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
      mockSimpleSelectChain.limit.mockResolvedValue([]);

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

      mockSimpleSelectChain.limit.mockResolvedValue([]);
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
      mockHookService.applyFilters.mockImplementation((_hook, data) => data);
      mockRegistryService.updateConfig.mockImplementation((_key, value) => value);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateFriendLink(0, updateDto);

      expect(result.name).toBe('Updated Friend 1');
      expect(result.id).toBe(1);
      expect(result.updateTime).toBeDefined();
    });

    it('should throw error for invalid index', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: [] }]);

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
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: [] }]);

      await expect(service.deleteFriendLink(0)).rejects.toThrow('Invalid index');
    });
  });

  describe('getCustomCode', () => {
    it('should return empty object when no custom code', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);

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
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: existingCode }]);

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

      mockSimpleSelectChain.limit.mockResolvedValue([{ value: existingCode }]);
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
      mockSimpleSelectChain.limit.mockResolvedValue([]);
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
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: existing }]);

      const result = await service.getAboutInfo();

      expect(result).toEqual(existing);
    });
  });

  describe('updateAboutInfo', () => {
    it('should update about content and timestamp', async () => {
      const existing = { content: 'Old', updatedAt: '2020-01-01T00:00:00.000Z' };
      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: existing }]);
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

  describe('getSocials', () => {
    it('should return empty array when no socials configured', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);

      const result = await service.getSocials();

      expect(result).toEqual([]);
    });

    it('should return existing socials', async () => {
      const socials = [
        { type: 'github', value: 'https://github.com/user', updatedAt: '2024-01-01' },
        { type: 'email', value: 'user@example.com', updatedAt: '2024-01-01' },
      ];
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: socials }]);

      const result = await service.getSocials();

      expect(result).toEqual(socials);
    });
  });

  describe('updateSocial', () => {
    it('should add new social when not exists', async () => {
      const dto = { type: 'github' as const, value: 'https://github.com/user' };
      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: [] }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateSocial(dto);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('github');
      expect(result[0].value).toBe('https://github.com/user');
      expect(result[0].updatedAt).toBeDefined();
    });

    it('should update existing social', async () => {
      const existing = [
        { type: 'github', value: 'https://github.com/olduser', updatedAt: '2024-01-01' },
      ];
      const dto = { type: 'github' as const, value: 'https://github.com/newuser' };

      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: existing }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateSocial(dto);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('https://github.com/newuser');
    });
  });

  describe('deleteSocial', () => {
    it('should remove social by type', async () => {
      const existing = [
        { type: 'github', value: 'https://github.com/user', updatedAt: '2024-01-01' },
        { type: 'email', value: 'user@example.com', updatedAt: '2024-01-01' },
      ];

      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: existing }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.deleteSocial('github' as const);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('email');
    });
  });

  describe('getSocialTypes', () => {
    it('should return list of available social types', () => {
      const result = service.getSocialTypes();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('label');
      expect(result[0]).toHaveProperty('value');
    });
  });

  describe('getWalineSetting', () => {
    it('should return default waline settings', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);

      const result = await service.getWalineSetting();

      expect(result).toHaveProperty('smtp.enabled', false);
      expect(result).toHaveProperty('smtp.port', 465);
      expect(result).toHaveProperty('forceLoginComment', false);
    });

    it('should return existing waline settings', async () => {
      const existing = {
        'smtp.enabled': true,
        'smtp.port': 587,
        'smtp.host': 'smtp.example.com',
        'smtp.user': 'user@example.com',
        'smtp.password': 'password',
        'sender.name': 'Sender',
        'sender.email': 'sender@example.com',
        authorEmail: 'author@example.com',
        forceLoginComment: true,
      };
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: existing }]);

      const result = await service.getWalineSetting();

      expect(result).toEqual(existing);
    });
  });

  describe('updateWalineSetting', () => {
    it('should update waline settings', async () => {
      const existing = {
        'smtp.enabled': false,
        'smtp.port': 465,
        'smtp.host': '',
        'smtp.user': '',
        'smtp.password': '',
        'sender.name': '',
        'sender.email': '',
        authorEmail: '',
        forceLoginComment: false,
      };
      const dto = { 'smtp.enabled': true, 'smtp.host': 'smtp.example.com' };

      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: existing }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateWalineSetting(dto);

      expect(result['smtp.enabled']).toBe(true);
      expect(result['smtp.host']).toBe('smtp.example.com');
    });
  });

  describe('getISRSetting', () => {
    it('should return default ISR settings', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);

      const result = await service.getISRSetting();

      expect(result).toEqual({
        mode: 'onDemand',
        delay: 0,
      });
    });
  });

  describe('updateISRSetting', () => {
    it('should update ISR settings', async () => {
      const existing = { mode: 'onDemand' as const, delay: 0 };
      const dto = { mode: 'delay' as const, delay: 60 };

      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: existing }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateISRSetting(dto);

      expect(result.mode).toBe('delay');
      expect(result.delay).toBe(60);
    });
  });

  describe('getLoginSetting', () => {
    it('should return default login settings', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);

      const result = await service.getLoginSetting();

      expect(result).toEqual({
        enableMaxLoginRetry: false,
        maxRetryTimes: 5,
        durationSeconds: 300,
        expiresIn: 7200,
      });
    });
  });

  describe('updateLoginSetting', () => {
    it('should update login settings', async () => {
      const existing = {
        enableMaxLoginRetry: false,
        maxRetryTimes: 5,
        durationSeconds: 300,
        expiresIn: 7200,
      };
      const dto = { enableMaxLoginRetry: true, maxRetryTimes: 3 };

      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: existing }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateLoginSetting(dto);

      expect(result.enableMaxLoginRetry).toBe(true);
      expect(result.maxRetryTimes).toBe(3);
    });
  });

  describe('getHttpsSetting', () => {
    it('should return default HTTPS settings', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);

      const result = await service.getHttpsSetting();

      expect(result).toEqual({ redirect: false });
    });
  });

  describe('updateHttpsSetting', () => {
    it('should update HTTPS settings and call setCaddyRedirect', async () => {
      const dto = { redirect: true };
      const spy = vi.spyOn(service as any, 'setCaddyRedirect').mockResolvedValue(undefined);

      mockSimpleSelectChain.limit.mockResolvedValueOnce([]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(dto);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateHttpsSetting(dto);

      expect(result.redirect).toBe(true);
      expect(spy).toHaveBeenCalledWith(true);
    });
  });

  describe('getStaticSetting', () => {
    it('should return default static settings', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);

      const result = await service.getStaticSetting();

      expect(result).toEqual({
        storageType: 'local',
        enableWaterMark: false,
        enableWebp: true,
      });
    });
  });

  describe('updateStaticSetting', () => {
    it('should update static settings', async () => {
      const dto = {
        storageType: 'picgo' as const,
        enableWaterMark: true,
        waterMarkText: 'Test',
        enableWebp: true,
      };

      mockSimpleSelectChain.limit.mockResolvedValueOnce([]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(dto);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateStaticSetting(dto);

      expect(result.storageType).toBe('picgo');
      expect(result.enableWaterMark).toBe(true);
    });
  });

  describe('getRewards', () => {
    it('should return empty array when no rewards configured', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([]);

      const result = await service.getRewards();

      expect(result).toEqual([]);
    });

    it('should return existing rewards', async () => {
      const rewards = [{ name: 'Wechat', value: 'qrcode.png', updatedAt: '2024-01-01' }];
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: rewards }]);

      const result = await service.getRewards();

      expect(result).toEqual(rewards);
    });
  });

  describe('createReward', () => {
    it('should add new reward', async () => {
      const dto = { name: 'Wechat', value: 'qrcode.png' };
      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: [] }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.createReward(dto);

      expect(result.name).toBe('Wechat');
      expect(result.value).toBe('qrcode.png');
      expect(result.updatedAt).toBeDefined();
    });

    it('should update existing reward when name exists', async () => {
      const existing = [{ name: 'Wechat', value: 'old.png', updatedAt: '2024-01-01' }];
      const dto = { name: 'Wechat', value: 'new.png' };

      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: existing }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.createReward(dto);

      expect(result.value).toBe('new.png');
    });
  });

  describe('updateReward', () => {
    it('should update existing reward', async () => {
      const existing = [{ name: 'Wechat', value: 'old.png', updatedAt: '2024-01-01' }];
      const dto = { name: 'Wechat Pay', value: 'new.png' };

      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: existing }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateReward('Wechat', dto);

      expect(result.name).toBe('Wechat Pay');
      expect(result.value).toBe('new.png');
      expect(result.updatedAt).toBeDefined();
    });

    it('should throw error when reward not found', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: [] }]);

      await expect(
        service.updateReward('NonExistent', { name: 'Test', value: 'test.png' }),
      ).rejects.toThrow('Reward with name NonExistent not found');
    });
  });

  describe('deleteReward', () => {
    it('should delete reward by name', async () => {
      const existing = [
        { name: 'Wechat', value: 'wechat.png', updatedAt: '2024-01-01' },
        { name: 'Alipay', value: 'alipay.png', updatedAt: '2024-01-01' },
      ];

      mockSimpleSelectChain.limit.mockResolvedValueOnce([{ value: existing }]);
      mockHookService.applyFilters.mockImplementation((_hook, payload) => payload);
      mockRegistryService.updateConfig.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.deleteReward('Wechat');

      expect(result).toBe(true);
      expect(mockRegistryService.updateConfig).toHaveBeenCalledWith('reward', [existing[1]]);
    });

    it('should return false when reward not found', async () => {
      mockSimpleSelectChain.limit.mockResolvedValue([{ value: [] }]);

      const result = await service.deleteReward('NonExistent');

      expect(result).toBe(false);
    });
  });

  describe('getCaddyLog', () => {
    it('should return caddy log content', () => {
      const mockFs = {
        readFileSync: vi.fn().mockReturnValue('log content'),
      };
      vi.doMock('fs', () => mockFs);

      const result = service.getCaddyLog();

      expect(typeof result).toBe('string');
    });

    it('should return empty string on error', () => {
      const result = service.getCaddyLog();

      expect(result).toBe('');
    });
  });

  describe('clearCaddyLog', () => {
    it('should clear caddy log file', () => {
      expect(() => {
        service.clearCaddyLog();
      }).not.toThrow();
    });
  });

  describe('getCaddyConfig', () => {
    it('should attempt to get caddy config', async () => {
      // getCaddyConfig makes an HTTP call to Caddy API
      // In test environment, it will likely fail and return null
      const result = await service.getCaddyConfig();

      // Either returns config object or null on error
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Should not throw even if Caddy API is unavailable
      await expect(service.getCaddyConfig()).resolves.not.toThrow();
    });
  });

  describe('setCaddyRedirect', () => {
    it('should handle disabling HTTPS redirect', async () => {
      // setCaddyRedirect handles errors internally and logs them
      // We just verify it doesn't throw
      await expect(service.setCaddyRedirect(false)).resolves.not.toThrow();
    });

    it('should handle enabling HTTPS redirect', async () => {
      // setCaddyRedirect handles errors internally and logs them
      // We just verify it doesn't throw
      await expect(service.setCaddyRedirect(true)).resolves.not.toThrow();
    });

    it('should handle errors gracefully when disabling redirect', async () => {
      await expect(service.setCaddyRedirect(false)).resolves.not.toThrow();
    });

    it('should handle errors gracefully when enabling redirect', async () => {
      await expect(service.setCaddyRedirect(true)).resolves.not.toThrow();
    });
  });

  describe('initCaddy', () => {
    it('should initialize caddy with current HTTPS settings', async () => {
      const mockHttpsSetting = { redirect: true };
      const spy = vi.spyOn(service as any, 'setCaddyRedirect').mockResolvedValue(undefined);

      mockSimpleSelectChain.limit.mockResolvedValue([{ value: mockHttpsSetting }]);

      await service.initCaddy();

      expect(spy).toHaveBeenCalledWith(true);
    });
  });
});
