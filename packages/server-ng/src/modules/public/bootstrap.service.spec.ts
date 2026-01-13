import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { Mock } from '@test/mock';

import { StatisticsService } from '../../shared/services/statistics.service';
import { CategoryService } from '../category/category.service';
import { CommentService } from '../comment/comment.service';
import { HookService } from '../plugin/services/hook.service';
import { PluginDataValidator } from '../plugin/services/plugin-data.validator';
import { PluginRegistryService } from '../plugin/services/plugin-registry.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { TagService } from '../tag/tag.service';

import { BootstrapService } from './bootstrap.service';

describe('BootstrapService', () => {
  let service: BootstrapService;
  let mockConfigService: any;
  let mockStatisticsService: any;
  let mockSettingCoreService: any;
  let mockCommentService: any;
  let mockTagService: any;
  let mockCategoryService: any;
  let mockHookService: any;
  let mockPluginRegistryService: any;
  let mockPluginDataValidator: any;

  beforeEach(async () => {
    // 使用 MockUtils 创建所有 Mock 服务
    mockConfigService = {
      get: vi.fn(),
    };
    mockStatisticsService = Mock.statistics();
    mockSettingCoreService = Mock.settingCore();
    mockCommentService = Mock.commentService();
    mockTagService = Mock.tagService();
    mockCategoryService = Mock.categoryService();
    mockHookService = Mock.hook();
    mockPluginRegistryService = {
      getAllPublicData: vi.fn(),
    };
    mockPluginDataValidator = {
      normalizeProviderResult: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BootstrapService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StatisticsService, useValue: mockStatisticsService },
        { provide: SettingCoreService, useValue: mockSettingCoreService },
        { provide: CommentService, useValue: mockCommentService },
        { provide: TagService, useValue: mockTagService },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: HookService, useValue: mockHookService as any },
        { provide: PluginRegistryService, useValue: mockPluginRegistryService },
        { provide: PluginDataValidator, useValue: mockPluginDataValidator },
      ],
    }).compile();

    service = module.get<BootstrapService>(BootstrapService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPublicBootstrap', () => {
    it('should aggregate all bootstrap data successfully', async () => {
      // Setup mocks
      mockConfigService.get.mockReturnValue('1.0.0');
      mockTagService.findAll.mockResolvedValue({
        items: [{ name: 'tag1' }, { name: 'tag2' }],
      });
      mockCategoryService.findAll.mockResolvedValue({
        items: [{ name: 'cat1' }, { name: 'cat2' }],
      });
      mockStatisticsService.getOverallStatistics.mockResolvedValue({
        publishedArticles: 10,
        totalViews: 100,
      });
      mockStatisticsService.getTotalPublishedWordCount.mockResolvedValue(5000);
      mockSettingCoreService.getSiteInfo.mockResolvedValue({
        title: 'Test Blog',
        description: 'Test Description',
        author: 'Test Author',
        keywords: ['test'],
      });
      mockSettingCoreService.getNavigation.mockResolvedValue([{ name: 'Home', path: '/' }]);
      mockSettingCoreService.getFriendLinks.mockResolvedValue([
        { name: 'Friend', url: 'https://friend.com' },
      ]);
      mockCommentService.getResolvedWalineConfig.mockResolvedValue({
        serverURL: 'https://waline.example.com',
      });
      mockPluginRegistryService.getAllPublicData.mockResolvedValue({
        testPlugin: { enabled: true },
      });
      mockPluginDataValidator.normalizeProviderResult.mockImplementation(
        (_: any, data: any) => data,
      );
      mockHookService.doAction.mockResolvedValue(undefined);
      mockHookService.applyFilters.mockImplementation((_: any, data: any) => Promise.resolve(data));

      // Execute
      const result = await service.getPublicBootstrap();

      // Verify
      expect(result).toEqual({
        version: '1.0.0',
        tags: ['tag1', 'tag2'],
        categories: ['cat1', 'cat2'],
        totalArticles: 10,
        totalWordCount: 5000,
        siteInfo: {
          title: 'Test Blog',
          description: 'Test Description',
          author: 'Test Author',
          keywords: ['test'],
        },
        navigation: [{ name: 'Home', path: '/' }],
        friendLinks: [{ name: 'Friend', url: 'https://friend.com' }],
        walineConfig: { serverURL: 'https://waline.example.com' },
        extensions: { testPlugin: { enabled: true } },
      });

      // Verify hook calls
      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'bootstrap|beforeGenerate',
        {},
        { action: 'public' },
      );
      expect(mockHookService.applyFilters).toHaveBeenCalledWith(
        'bootstrap|transformResponse',
        expect.any(Object),
        { action: 'public' },
      );
      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'bootstrap|afterGenerate',
        expect.any(Object),
        { action: 'public' },
      );
    });

    it('should handle partial data failures gracefully', async () => {
      mockConfigService.get.mockReturnValue('dev');
      mockTagService.findAll.mockRejectedValue(new Error('Tag service error'));
      mockCategoryService.findAll.mockRejectedValue(new Error('Category service error'));
      mockStatisticsService.getOverallStatistics.mockRejectedValue(new Error('Stats error'));
      mockStatisticsService.getTotalPublishedWordCount.mockRejectedValue(
        new Error('Word count error'),
      );
      mockSettingCoreService.getSiteInfo.mockRejectedValue(new Error('Site info error'));
      mockSettingCoreService.getNavigation.mockResolvedValue([]);
      mockSettingCoreService.getFriendLinks.mockResolvedValue([]);
      mockCommentService.getResolvedWalineConfig.mockResolvedValue(undefined);
      mockPluginRegistryService.getAllPublicData.mockResolvedValue({});
      mockHookService.doAction.mockResolvedValue(undefined);
      mockHookService.applyFilters.mockImplementation((_: any, data: any) => Promise.resolve(data));

      const result = await service.getPublicBootstrap();

      expect(result).toEqual({
        version: 'dev',
        tags: [],
        categories: [],
        totalArticles: 0,
        totalWordCount: 0,
        siteInfo: {
          title: 'My Blog',
          description: 'A blog powered by VanBlog',
          author: 'Admin',
          keywords: [],
        },
        navigation: [],
        friendLinks: [],
        extensions: {},
      });
    });

    it('should handle plugin hook errors gracefully', async () => {
      mockConfigService.get.mockReturnValue('1.0.0');
      mockTagService.findAll.mockResolvedValue({ items: [] });
      mockCategoryService.findAll.mockResolvedValue({ items: [] });
      mockStatisticsService.getOverallStatistics.mockResolvedValue({ publishedArticles: 0 });
      mockStatisticsService.getTotalPublishedWordCount.mockResolvedValue(0);
      mockSettingCoreService.getSiteInfo.mockResolvedValue({
        title: 'Test',
        description: 'Test',
        author: 'Test',
        keywords: [],
      });
      mockSettingCoreService.getNavigation.mockResolvedValue([]);
      mockSettingCoreService.getFriendLinks.mockResolvedValue([]);
      mockCommentService.getResolvedWalineConfig.mockResolvedValue(undefined);
      mockPluginRegistryService.getAllPublicData.mockResolvedValue({});

      // Simulate hook errors
      mockHookService.doAction.mockRejectedValue(new Error('Hook error'));
      mockHookService.applyFilters.mockRejectedValue(new Error('Filter error'));

      // Should not throw
      const result = await service.getPublicBootstrap();

      expect(result).toBeDefined();
      expect(result.version).toBe('1.0.0');
    });

    it('should filter invalid plugin data', async () => {
      mockConfigService.get.mockReturnValue('1.0.0');
      mockTagService.findAll.mockResolvedValue({ items: [] });
      mockCategoryService.findAll.mockResolvedValue({ items: [] });
      mockStatisticsService.getOverallStatistics.mockResolvedValue({ publishedArticles: 0 });
      mockStatisticsService.getTotalPublishedWordCount.mockResolvedValue(0);
      mockSettingCoreService.getSiteInfo.mockResolvedValue({
        title: 'Test',
        description: 'Test',
        author: 'Test',
        keywords: [],
      });
      mockSettingCoreService.getNavigation.mockResolvedValue([]);
      mockSettingCoreService.getFriendLinks.mockResolvedValue([]);
      mockCommentService.getResolvedWalineConfig.mockResolvedValue(undefined);
      mockPluginRegistryService.getAllPublicData.mockResolvedValue({
        validPlugin: { data: 'valid' },
        invalidPlugin: { data: 'invalid' },
      });
      mockHookService.doAction.mockResolvedValue(undefined);
      mockHookService.applyFilters.mockImplementation((_: any, data: any) => Promise.resolve(data));

      // Only normalize valid plugin
      mockPluginDataValidator.normalizeProviderResult.mockImplementation((name: any, data: any) => {
        if (name === 'validPlugin') return data;
        return undefined;
      });

      const result = await service.getPublicBootstrap();

      expect(result.extensions).toEqual({ validPlugin: { data: 'valid' } });
      expect(mockPluginDataValidator.normalizeProviderResult).toHaveBeenCalledTimes(2);
    });

    it('should use default version when APP_VERSION is not set', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockTagService.findAll.mockResolvedValue({ items: [] });
      mockCategoryService.findAll.mockResolvedValue({ items: [] });
      mockStatisticsService.getOverallStatistics.mockResolvedValue({ publishedArticles: 0 });
      mockStatisticsService.getTotalPublishedWordCount.mockResolvedValue(0);
      mockSettingCoreService.getSiteInfo.mockResolvedValue({
        title: 'Test',
        description: 'Test',
        author: 'Test',
        keywords: [],
      });
      mockSettingCoreService.getNavigation.mockResolvedValue([]);
      mockSettingCoreService.getFriendLinks.mockResolvedValue([]);
      mockCommentService.getResolvedWalineConfig.mockResolvedValue(undefined);
      mockPluginRegistryService.getAllPublicData.mockResolvedValue({});
      mockHookService.doAction.mockResolvedValue(undefined);
      mockHookService.applyFilters.mockImplementation((_: any, data: any) => Promise.resolve(data));

      const result = await service.getPublicBootstrap();

      expect(result.version).toBe('dev');
    });

    it('should exclude walineConfig when undefined', async () => {
      mockConfigService.get.mockReturnValue('1.0.0');
      mockTagService.findAll.mockResolvedValue({ items: [] });
      mockCategoryService.findAll.mockResolvedValue({ items: [] });
      mockStatisticsService.getOverallStatistics.mockResolvedValue({ publishedArticles: 0 });
      mockStatisticsService.getTotalPublishedWordCount.mockResolvedValue(0);
      mockSettingCoreService.getSiteInfo.mockResolvedValue({
        title: 'Test',
        description: 'Test',
        author: 'Test',
        keywords: [],
      });
      mockSettingCoreService.getNavigation.mockResolvedValue([]);
      mockSettingCoreService.getFriendLinks.mockResolvedValue([]);
      mockCommentService.getResolvedWalineConfig.mockResolvedValue(undefined);
      mockPluginRegistryService.getAllPublicData.mockResolvedValue({});
      mockHookService.doAction.mockResolvedValue(undefined);
      mockHookService.applyFilters.mockImplementation((_: any, data: any) => Promise.resolve(data));

      const result = await service.getPublicBootstrap();

      expect(result).not.toHaveProperty('walineConfig');
    });
  });
});
