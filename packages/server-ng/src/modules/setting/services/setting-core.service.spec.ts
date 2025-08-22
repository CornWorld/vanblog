import { Test, type TestingModule } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../database/database.module';
import { HookService } from '../../plugin/services/hook.service';

import {
  SettingCoreService,
  type SiteInfo,
  type Navigation,
  type FriendLink,
  type CustomCode,
} from './setting-core.service';

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

  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  const mockInsertChain = {
    values: vi.fn(),
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
      mockInsertChain.values.mockResolvedValue(undefined);

      const result = await service.getConfig('testKey', defaultValue);

      expect(result).toEqual(defaultValue);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockInsertChain.values).toHaveBeenCalledWith({
        key: 'testKey',
        value: JSON.stringify(defaultValue),
      });
    });

    it('should return null when no config and no default', async () => {
      mockSelectChain.limit.mockResolvedValue([]);

      const result = await service.getConfig('testKey');

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should update existing config', async () => {
      const testValue = { updated: 'value' };
      const filteredData = { key: 'testKey', value: testValue };

      mockHookService.applyFilters.mockResolvedValue(filteredData);
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify({ old: 'value' }) }]);
      mockUpdateChain.where.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateConfig('testKey', testValue);

      expect(result).toEqual(testValue);
      expect(mockHookService.applyFilters).toHaveBeenCalledWith('setting|beforeUpdate', {
        key: 'testKey',
        value: testValue,
      });
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockHookService.doAction).toHaveBeenCalledTimes(2);
    });

    it('should create new config when not exists', async () => {
      const testValue = { new: 'value' };
      const filteredData = { key: 'testKey', value: testValue };

      mockHookService.applyFilters.mockResolvedValue(filteredData);
      mockSelectChain.limit.mockResolvedValue([]);
      mockInsertChain.values.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateConfig('testKey', testValue);

      expect(result).toEqual(testValue);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockInsertChain.values).toHaveBeenCalledWith({
        key: 'testKey',
        value: JSON.stringify(testValue),
      });
    });
  });

  describe('getSiteInfo', () => {
    it('should return site info with defaults', async () => {
      mockSelectChain.limit.mockResolvedValue([]);
      mockInsertChain.values.mockResolvedValue(undefined);

      const result = await service.getSiteInfo();

      expect(result).toEqual({
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
      mockUpdateChain.where.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateSiteInfo(updateDto);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('getLayoutSettings', () => {
    it('should return layout settings with defaults', async () => {
      mockSelectChain.limit.mockResolvedValue([]);
      mockInsertChain.values.mockResolvedValue(undefined);

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
      mockInsertChain.values.mockResolvedValue(undefined);

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
      const newLink: FriendLink = {
        name: 'Test Friend',
        url: 'https://test.com',
        description: 'Test description',
      };

      mockSelectChain.limit.mockResolvedValue([]);
      mockHookService.applyFilters.mockResolvedValue({ key: 'friendLinks', value: [newLink] });
      mockInsertChain.values.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.createFriendLink(newLink);

      expect(result).toEqual([newLink]);
    });
  });

  describe('updateFriendLink', () => {
    it('should update existing friend link', async () => {
      const existingLinks: FriendLink[] = [
        { name: 'Friend 1', url: 'https://friend1.com' },
        { name: 'Friend 2', url: 'https://friend2.com' },
      ];
      const updateDto = { name: 'Updated Friend 1' };
      const expectedResult = [{ ...existingLinks[0], ...updateDto }, existingLinks[1]];

      // Mock getFriendLinks to return existing links
      vi.spyOn(service, 'getFriendLinks').mockResolvedValue(existingLinks);
      mockHookService.applyFilters.mockResolvedValue({ key: 'friendLinks', value: expectedResult });
      mockUpdateChain.where.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateFriendLink(0, updateDto);

      expect(result).toEqual(expectedResult);
    });

    it('should throw error for invalid index', async () => {
      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify([]) }]);

      await expect(service.updateFriendLink(0, { name: 'Test' })).rejects.toThrow('Invalid index');
    });
  });

  describe('deleteFriendLink', () => {
    it('should delete friend link at index', async () => {
      const existingLinks: FriendLink[] = [
        { name: 'Friend 1', url: 'https://friend1.com' },
        { name: 'Friend 2', url: 'https://friend2.com' },
      ];
      const expectedResult = [existingLinks[1]];

      // Mock getFriendLinks to return existing links
      vi.spyOn(service, 'getFriendLinks').mockResolvedValue(existingLinks);
      mockHookService.applyFilters.mockResolvedValue({ key: 'friendLinks', value: expectedResult });
      mockUpdateChain.where.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.deleteFriendLink(0);

      expect(result).toEqual(expectedResult);
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

      expect(result).toEqual({});
    });

    it('should return existing custom code', async () => {
      const existingCode: CustomCode = {
        head: '<meta name="test" content="test">',
        body: '<script>console.log("test")</script>',
        footer: '<p>Footer</p>',
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
      const updateDto = { body: '<script>console.log("new")</script>' };
      const expectedResult = { ...existingCode, ...updateDto };

      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(existingCode) }]);
      mockHookService.applyFilters.mockResolvedValue({ key: 'customCode', value: expectedResult });
      mockUpdateChain.where.mockResolvedValue(undefined);
      mockHookService.doAction.mockResolvedValue(undefined);

      const result = await service.updateCustomCode(updateDto);

      expect(result).toEqual(expectedResult);
    });
  });
});
