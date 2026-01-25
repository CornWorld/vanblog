import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { ArticleService } from '../article/article.service';
import { CategoryService } from '../category/category.service';
import { CommentService } from '../comment/comment.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { TagService } from '../tag/tag.service';

import { OptionsService } from './options.service';

const mockArticleService = {
  findAll: vi.fn(),
};

const mockCategoryService = {
  findAll: vi.fn(),
};

const mockTagService = {
  findAll: vi.fn(),
};

const mockSettingCoreService = {
  getSiteInfo: vi.fn(),
  getNavigation: vi.fn(),
  getFriendLinks: vi.fn(),
};

const mockCommentService = {
  getResolvedWalineConfig: vi.fn(),
};

describe('OptionsService (Public)', () => {
  let service: OptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionsService,
        { provide: ArticleService, useValue: mockArticleService },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: TagService, useValue: mockTagService },
        { provide: SettingCoreService, useValue: mockSettingCoreService },
        { provide: CommentService, useValue: mockCommentService },
      ],
    }).compile();

    service = module.get<OptionsService>(OptionsService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty response when no includes specified', async () => {
    const result = await service.getOptions({ include: [] });

    expect(result).toEqual({});
    expect(mockArticleService.findAll).not.toHaveBeenCalled();
    expect(mockCategoryService.findAll).not.toHaveBeenCalled();
    expect(mockTagService.findAll).not.toHaveBeenCalled();
  });

  it('should fetch articles when included', async () => {
    const mockArticles = {
      items: [{ id: 1, title: 'Test Article' }],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockArticleService.findAll.mockResolvedValue(mockArticles);

    const result = await service.getOptions({ include: ['articles'] });

    expect(mockArticleService.findAll).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      includeHidden: false,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(result.articles).toEqual(mockArticles);
  });

  it('should fetch categories when included', async () => {
    const mockCategories = {
      items: [
        { name: 'Tech', slug: 'tech', description: 'Technology articles' },
        { name: 'Life', slug: 'life', description: null },
      ],
      total: 2,
    };
    mockCategoryService.findAll.mockResolvedValue(mockCategories);

    const result = await service.getOptions({ include: ['categories'] });

    expect(mockCategoryService.findAll).toHaveBeenCalled();
    expect(result.categories).toEqual([
      { name: 'Tech', slug: 'tech', description: 'Technology articles' },
      { name: 'Life', slug: 'life', description: undefined },
    ]);
  });

  it('should fetch tags when included', async () => {
    const mockTags = {
      items: [
        { name: 'JavaScript', slug: 'javascript' },
        { name: 'TypeScript', slug: 'typescript' },
      ],
      total: 2,
    };
    mockTagService.findAll.mockResolvedValue(mockTags);

    const result = await service.getOptions({ include: ['tags'] });

    expect(mockTagService.findAll).toHaveBeenCalled();
    expect(result.tags).toEqual([
      { name: 'JavaScript', slug: 'javascript' },
      { name: 'TypeScript', slug: 'typescript' },
    ]);
  });

  it('should fetch siteMeta when included', async () => {
    const mockSiteInfo = {
      title: 'My Blog',
      description: 'A test blog',
      author: 'John Doe',
      keywords: 'blog, tech',
    };
    mockSettingCoreService.getSiteInfo.mockResolvedValue(mockSiteInfo);

    const result = await service.getOptions({ include: ['siteMeta'] });

    expect(mockSettingCoreService.getSiteInfo).toHaveBeenCalled();
    expect(result.siteMeta).toEqual(mockSiteInfo);
  });

  it('should fetch navigation when included', async () => {
    const mockNavigation = [
      { name: 'Home', url: '/' },
      { name: 'About', url: '/about' },
    ];
    mockSettingCoreService.getNavigation.mockResolvedValue(mockNavigation);

    const result = await service.getOptions({ include: ['navigation'] });

    expect(mockSettingCoreService.getNavigation).toHaveBeenCalled();
    expect(result.navigation).toEqual(mockNavigation);
  });

  it('should fetch friendLinks when included', async () => {
    const mockFriendLinks = [
      { name: 'Friend 1', url: 'https://friend1.com' },
      { name: 'Friend 2', url: 'https://friend2.com' },
    ];
    mockSettingCoreService.getFriendLinks.mockResolvedValue(mockFriendLinks);

    const result = await service.getOptions({ include: ['friendLinks'] });

    expect(mockSettingCoreService.getFriendLinks).toHaveBeenCalled();
    expect(result.friendLinks).toEqual(mockFriendLinks);
  });

  it('should fetch walineConfig when included', async () => {
    const mockWalineConfig = { serverURL: 'https://waline.example.com' };
    mockCommentService.getResolvedWalineConfig.mockResolvedValue(mockWalineConfig);

    const result = await service.getOptions({ include: ['walineConfig'] });

    expect(mockCommentService.getResolvedWalineConfig).toHaveBeenCalled();
    expect(result.walineConfig).toEqual({ serverURL: 'https://waline.example.com' });
  });

  it('should not include walineConfig when serverURL is empty', async () => {
    const mockWalineConfig = { serverURL: '' };
    mockCommentService.getResolvedWalineConfig.mockResolvedValue(mockWalineConfig);

    const result = await service.getOptions({ include: ['walineConfig'] });

    expect(mockCommentService.getResolvedWalineConfig).toHaveBeenCalled();
    expect(result.walineConfig).toBeUndefined();
  });

  it('should handle walineConfig fetch error gracefully', async () => {
    mockCommentService.getResolvedWalineConfig.mockRejectedValue(new Error('Waline error'));

    const result = await service.getOptions({ include: ['walineConfig'] });

    expect(mockCommentService.getResolvedWalineConfig).toHaveBeenCalled();
    expect(result.walineConfig).toBeUndefined();
  });

  it('should fetch multiple includes in parallel', async () => {
    const mockArticles = { items: [], total: 0, page: 1, pageSize: 20 };
    const mockCategories = { items: [], total: 0 };
    const mockTags = { items: [], total: 0 };

    mockArticleService.findAll.mockResolvedValue(mockArticles);
    mockCategoryService.findAll.mockResolvedValue(mockCategories);
    mockTagService.findAll.mockResolvedValue(mockTags);

    const result = await service.getOptions({ include: ['articles', 'categories', 'tags'] });

    expect(mockArticleService.findAll).toHaveBeenCalled();
    expect(mockCategoryService.findAll).toHaveBeenCalled();
    expect(mockTagService.findAll).toHaveBeenCalled();
    expect(result.articles).toEqual(mockArticles);
    expect(result.categories).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it('should filter out non-string values in include array', async () => {
    await service.getOptions({
      include: ['articles', 123, null, undefined, 'categories'] as any,
    });

    expect(mockArticleService.findAll).toHaveBeenCalled();
    expect(mockCategoryService.findAll).toHaveBeenCalled();
  });

  it('should ignore invalid include options', async () => {
    const result = await service.getOptions({
      include: ['articles', 'invalidOption', 'categories'] as any,
    });

    expect(mockArticleService.findAll).toHaveBeenCalled();
    expect(mockCategoryService.findAll).toHaveBeenCalled();
    expect(result).not.toHaveProperty('invalidOption');
  });

  it('should handle Promise.allSettled with mixed results', async () => {
    const mockArticles = { items: [], total: 0, page: 1, pageSize: 20 };
    mockArticleService.findAll.mockResolvedValue(mockArticles);
    mockCategoryService.findAll.mockRejectedValue(new Error('Category error'));

    const result = await service.getOptions({ include: ['articles', 'categories'] });

    expect(result.articles).toEqual(mockArticles);
    expect(result.categories).toBeUndefined();
  });

  describe('Edge cases', () => {
    it('should handle null description in categories', async () => {
      const mockCategories = {
        items: [
          { name: 'Tech', slug: 'tech', description: null },
          { name: 'Life', slug: 'life', description: undefined },
        ],
        total: 2,
      };
      mockCategoryService.findAll.mockResolvedValue(mockCategories);

      const result = await service.getOptions({ include: ['categories'] });

      expect((result.categories as any)?.[0]?.description).toBeUndefined();
      expect((result.categories as any)?.[1]?.description).toBeUndefined();
    });

    it('should handle empty articles array', async () => {
      const mockArticles = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      };
      mockArticleService.findAll.mockResolvedValue(mockArticles);

      const result = await service.getOptions({ include: ['articles'] });

      expect(result.articles?.items).toHaveLength(0);
      expect(result.articles?.total).toBe(0);
    });

    it('should handle empty categories array', async () => {
      const mockCategories = {
        items: [],
        total: 0,
      };
      mockCategoryService.findAll.mockResolvedValue(mockCategories);

      const result = await service.getOptions({ include: ['categories'] });

      expect(result.categories).toEqual([]);
    });

    it('should handle empty tags array', async () => {
      const mockTags = {
        items: [],
        total: 0,
      };
      mockTagService.findAll.mockResolvedValue(mockTags);

      const result = await service.getOptions({ include: ['tags'] });

      expect(result.tags).toEqual([]);
    });

    it('should handle undefined null in category slug', async () => {
      const mockCategories = {
        items: [{ name: 'NoSlug', slug: null }],
        total: 1,
      };
      mockCategoryService.findAll.mockResolvedValue(mockCategories);

      const result = await service.getOptions({ include: ['categories'] });

      expect((result.categories as any)?.[0]?.slug).toBe('');
    });

    it('should handle undefined null in tag slug', async () => {
      const mockTags = {
        items: [{ name: 'NoSlug', slug: null }],
        total: 1,
      };
      mockTagService.findAll.mockResolvedValue(mockTags);

      const result = await service.getOptions({ include: ['tags'] });

      expect((result.tags as any)?.[0]?.slug).toBe('');
    });

    it('should handle walineConfig with null serverURL', async () => {
      const mockWalineConfig = { serverURL: null };
      mockCommentService.getResolvedWalineConfig.mockResolvedValue(mockWalineConfig);

      const result = await service.getOptions({ include: ['walineConfig'] });

      expect(result.walineConfig).toBeUndefined();
    });

    it('should handle walineConfig with undefined serverURL', async () => {
      const mockWalineConfig = { serverURL: undefined };
      mockCommentService.getResolvedWalineConfig.mockResolvedValue(mockWalineConfig);

      const result = await service.getOptions({ include: ['walineConfig'] });

      expect(result.walineConfig).toBeUndefined();
    });
  });

  describe('Complex scenarios', () => {
    it('should fetch all includes together', async () => {
      const mockArticles = { items: [], total: 0, page: 1, pageSize: 20 };
      const mockCategories = { items: [{ name: 'Tech', slug: 'tech' }], total: 1 };
      const mockTags = { items: [{ name: 'JS', slug: 'js' }], total: 1 };
      const mockSiteInfo = {
        title: 'Blog',
        description: 'My blog',
        author: 'Me',
        keywords: ['blog'],
      };
      const mockNavigation = [{ name: 'Home', url: '/' }];
      const mockFriendLinks = [{ name: 'Friend', url: 'https://friend.com' }];
      const mockWalineConfig = { serverURL: 'https://waline.example.com' };

      mockArticleService.findAll.mockResolvedValue(mockArticles);
      mockCategoryService.findAll.mockResolvedValue(mockCategories);
      mockTagService.findAll.mockResolvedValue(mockTags);
      mockSettingCoreService.getSiteInfo.mockResolvedValue(mockSiteInfo);
      mockSettingCoreService.getNavigation.mockResolvedValue(mockNavigation);
      mockSettingCoreService.getFriendLinks.mockResolvedValue(mockFriendLinks);
      mockCommentService.getResolvedWalineConfig.mockResolvedValue(mockWalineConfig);

      const result = await service.getOptions({
        include: [
          'articles',
          'categories',
          'tags',
          'siteMeta',
          'navigation',
          'friendLinks',
          'walineConfig',
        ],
      });

      expect(result).toHaveProperty('articles');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('tags');
      expect(result).toHaveProperty('siteMeta');
      expect(result).toHaveProperty('navigation');
      expect(result).toHaveProperty('friendLinks');
      expect(result).toHaveProperty('walineConfig');
    });

    it('should handle partial service failures gracefully', async () => {
      const mockArticles = { items: [], total: 0, page: 1, pageSize: 20 };
      const mockSiteInfo = {
        title: 'Blog',
        description: 'My blog',
        author: 'Me',
        keywords: ['blog'],
      };

      mockArticleService.findAll.mockResolvedValue(mockArticles);
      mockCategoryService.findAll.mockRejectedValue(new Error('Category service down'));
      mockSettingCoreService.getSiteInfo.mockResolvedValue(mockSiteInfo);

      const result = await service.getOptions({
        include: ['articles', 'categories', 'siteMeta'],
      });

      expect(result.articles).toEqual(mockArticles);
      expect(result.categories).toBeUndefined();
      expect(result.siteMeta).toEqual(mockSiteInfo);
    });

    it('should maintain response structure with mixed empty and non-empty data', async () => {
      const mockArticles = { items: [], total: 0, page: 1, pageSize: 20 };
      const mockCategories = { items: [], total: 0 };
      const mockSiteInfo = {
        title: 'Blog',
        description: 'My blog',
        author: 'Me',
        keywords: ['blog'],
      };

      mockArticleService.findAll.mockResolvedValue(mockArticles);
      mockCategoryService.findAll.mockResolvedValue(mockCategories);
      mockSettingCoreService.getSiteInfo.mockResolvedValue(mockSiteInfo);

      const result = await service.getOptions({
        include: ['articles', 'categories', 'siteMeta'],
      });

      expect(result.articles?.items).toHaveLength(0);
      expect(result.categories).toHaveLength(0);
      expect(result.siteMeta?.title).toBe('Blog');
    });
  });

  // socialLinks and rewards have been removed from the system
  // Plugin data is now accessed through extensions field in bootstrap response
});
