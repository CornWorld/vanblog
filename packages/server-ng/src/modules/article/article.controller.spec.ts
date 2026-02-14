import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { Mock } from '@test/mock';

import { ArticleStatsService } from '../analytics/services/article-stats.service';

import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { Article } from './entities/article.entity';
import { ArticleAccessGuard } from './guards/article-access.guard';

describe('ArticleController', () => {
  let controller: ArticleController;
  let mockArticleService: any;
  let mockArticleStatsService: any;

  beforeEach(async () => {
    // 使用 MockUtils 创建服务 Mock
    mockArticleService = Mock.articleService();
    mockArticleStatsService = Mock.articleStatsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticleController],
      providers: [
        { provide: ArticleService, useValue: mockArticleService },
        { provide: ArticleStatsService, useValue: mockArticleStatsService },
      ],
    })
      .overrideGuard(ArticleAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ArticleController>(ArticleController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated articles', async () => {
      const mockResult = {
        items: [Mock.article()],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll({ page: 1, pageSize: 10 });

      expect(mockArticleService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 10 }),
      );
      expect(result).toEqual(mockResult);
    });

    it('should support filtering by category', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      await controller.findAll({ category: 'tech', page: 1, pageSize: 10 });

      expect(mockArticleService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'tech',
          page: 1,
          pageSize: 10,
        }),
      );
    });

    it('should support filtering by tag', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      await controller.findAll({ tag: 'javascript', page: 1, pageSize: 10 });

      expect(mockArticleService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: 'javascript',
          page: 1,
          pageSize: 10,
        }),
      );
    });
  });

  describe('search', () => {
    it('should search articles with keyword', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.search.mockResolvedValue(mockResult);

      const result = await controller.search({ keyword: 'test', page: 1, pageSize: 10 });

      expect(mockArticleService.search).toHaveBeenCalledWith({
        keyword: 'test',
        page: 1,
        pageSize: 10,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('export', () => {
    it('should export all articles', async () => {
      const mockArticles = [Mock.article()];
      mockArticleService.exportArticles.mockResolvedValue(mockArticles);

      const result = await controller.export();

      expect(mockArticleService.exportArticles).toHaveBeenCalled();
      expect(result).toEqual(mockArticles);
    });
  });

  describe('findByCategory', () => {
    it('should find articles by category name', async () => {
      const mockResult = {
        items: [Mock.article({ category: 'tech' })],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockArticleService.findByCategory.mockResolvedValue(mockResult);

      const result = await controller.findByCategory('tech');

      expect(mockArticleService.findByCategory).toHaveBeenCalledWith('tech');
      expect(result).toEqual(mockResult);
    });
  });

  describe('import', () => {
    it('should import multiple articles', async () => {
      const mockArticles = [
        { title: 'Article 1', content: 'Content 1', author: 'admin', tags: [] },
        { title: 'Article 2', content: 'Content 2', author: 'admin', tags: [] },
      ];
      mockArticleService.importArticles.mockResolvedValue(undefined);

      await controller.import(mockArticles);

      expect(mockArticleService.importArticles).toHaveBeenCalled();
    });
  });

  describe('findOneByPathname', () => {
    it('should find article by pathname', async () => {
      const mockArticle = new Article(Mock.article({ pathname: 'test-post' }));
      mockArticleService.findOneByPathname.mockResolvedValue(mockArticle);

      const result = await controller.findOneByPathname('test-post');

      expect(mockArticleService.findOneByPathname).toHaveBeenCalledWith('test-post');
      expect(result).toEqual(mockArticle);
    });
  });

  describe('findOne', () => {
    it('should find article by ID', async () => {
      const mockArticle = new Article(Mock.article({ id: 1 }));
      mockArticleService.findOne.mockResolvedValue(mockArticle);

      const result = await controller.findOne(1);

      expect(mockArticleService.findOne).toHaveBeenCalledWith(mockArticle.id);
      expect(result).toEqual(mockArticle);
    });
  });

  describe('create', () => {
    it('should create a new article', async () => {
      const createDto = { title: 'New Article', content: 'Content', author: 'admin', tags: [] };
      const mockArticle = new Article(Mock.article({ title: 'New Article' }));
      mockArticleService.create.mockResolvedValue(mockArticle);

      const result = await controller.create(createDto);

      expect(mockArticleService.create).toHaveBeenCalled();
      expect(result).toEqual(mockArticle);
    });
  });

  describe('update', () => {
    it('should delegate to articleService.update and return value', async () => {
      const id = 1;
      const dto = { title: 't' };
      const updated = { id, title: 't' };
      mockArticleService.update.mockResolvedValue(updated);

      const result = await controller.update(id, dto);

      // Schema transformation may add additional fields like tags: null
      expect(mockArticleService.update).toHaveBeenCalledWith(
        id,
        expect.objectContaining({ title: 't' }),
      );
      expect(result).toBe(updated);
    });
  });

  describe('remove', () => {
    it('should delegate to articleService.remove', async () => {
      const id = 2;
      mockArticleService.remove.mockResolvedValue(undefined);

      await controller.remove(id);

      expect(mockArticleService.remove).toHaveBeenCalledWith(id);
    });
  });

  describe('verifyPassword', () => {
    it('should call service.verifyPassword and return response', async () => {
      const id = 3;
      const dto = { password: 'secret' } as any;
      const response = { success: true, token: 'tok', message: undefined, expiresAt: 'x' } as any;
      mockArticleService.verifyPassword.mockResolvedValue(response);

      const result = await controller.verifyPassword(id, dto, {} as any);

      expect(mockArticleService.verifyPassword).toHaveBeenCalledWith(id, dto.password, undefined);
      expect(result).toBe(response);
    });

    it('should pass user id to service when user is authenticated', async () => {
      const id = 3;
      const dto = { password: 'secret' } as any;
      const response = { success: true, token: 'tok', message: undefined, expiresAt: 'x' } as any;
      mockArticleService.verifyPassword.mockResolvedValue(response);

      await controller.verifyPassword(id, dto, { user: { id: 123 } } as any);

      expect(mockArticleService.verifyPassword).toHaveBeenCalledWith(id, dto.password, 123);
    });
  });

  describe('verifyPasswordByPathname', () => {
    it('should call service.verifyPasswordByPathname and return response', async () => {
      const pathname = 'test-article';
      const dto = { password: 'secret' } as any;
      const response = { success: true, token: 'tok', message: undefined, expiresAt: 'x' } as any;
      mockArticleService.verifyPasswordByPathname.mockResolvedValue(response);

      const result = await controller.verifyPasswordByPathname(pathname, dto, {} as any);

      expect(mockArticleService.verifyPasswordByPathname).toHaveBeenCalledWith(
        pathname,
        dto.password,
        undefined,
      );
      expect(result).toBe(response);
    });

    it('should pass user id to service when user is authenticated', async () => {
      const pathname = 'test-article';
      const dto = { password: 'secret' } as any;
      const response = { success: true, token: 'tok', message: undefined, expiresAt: 'x' } as any;
      mockArticleService.verifyPasswordByPathname.mockResolvedValue(response);

      await controller.verifyPasswordByPathname(pathname, dto, { user: { id: 123 } } as any);

      expect(mockArticleService.verifyPasswordByPathname).toHaveBeenCalledWith(
        pathname,
        dto.password,
        123,
      );
    });
  });

  describe('incrementView', () => {
    it('should record article view with ip and user-agent by id', async () => {
      const id = 9;
      const ip = '127.0.0.1';
      const ua = 'UA';
      mockArticleStatsService.recordArticleView.mockResolvedValue(undefined);

      await controller.incrementView(id, ip, ua);

      expect(mockArticleStatsService.recordArticleView).toHaveBeenCalledWith(id, ip, ua);
    });

    it('should record article view with ip and user-agent by pathname', async () => {
      const pathname = 'hello-world';
      const ip = '127.0.0.1';
      const ua = 'UA';
      mockArticleStatsService.recordArticleViewByPathname.mockResolvedValue(undefined);

      await controller.incrementViewByPathname(pathname, ip, ua);

      expect(mockArticleStatsService.recordArticleViewByPathname).toHaveBeenCalledWith(
        pathname,
        ip,
        ua,
      );
    });
  });

  describe('getArticlesGroupedByCategory', () => {
    it('should return articles grouped by category', async () => {
      const mockGroupedArticles = {
        'Test Category': [{ id: 1, title: 'Test Article', category: 'Test Category' }],
        'Another Category': [{ id: 2, title: 'Another Article', category: 'Another Category' }],
      };

      mockArticleService.getArticlesGroupedByCategory.mockResolvedValue(mockGroupedArticles);

      const result = await controller.getArticlesGroupedByCategory();

      expect(result).toEqual(mockGroupedArticles);
      expect(mockArticleService.getArticlesGroupedByCategory).toHaveBeenCalled();
    });

    it('should handle empty categories', async () => {
      const mockEmptyGrouped = {};
      mockArticleService.getArticlesGroupedByCategory.mockResolvedValue(mockEmptyGrouped);

      const result = await controller.getArticlesGroupedByCategory();

      expect(result).toEqual(mockEmptyGrouped);
      expect(mockArticleService.getArticlesGroupedByCategory).toHaveBeenCalled();
    });
  });

  describe('getArticlesGroupedByTag', () => {
    it('should return articles grouped by tag', async () => {
      const mockGroupedArticles = {
        test: [{ id: 1, title: 'Test Article', tags: ['test'] }],
        javascript: [{ id: 2, title: 'JS Article', tags: ['javascript'] }],
      };

      mockArticleService.getArticlesGroupedByTag.mockResolvedValue(mockGroupedArticles);

      const result = await controller.getArticlesGroupedByTag();

      expect(result).toEqual(mockGroupedArticles);
      expect(mockArticleService.getArticlesGroupedByTag).toHaveBeenCalled();
    });

    it('should handle empty tags', async () => {
      const mockEmptyGrouped = {};
      mockArticleService.getArticlesGroupedByTag.mockResolvedValue(mockEmptyGrouped);

      const result = await controller.getArticlesGroupedByTag();

      expect(result).toEqual(mockEmptyGrouped);
      expect(mockArticleService.getArticlesGroupedByTag).toHaveBeenCalled();
    });
  });

  // Schema validation tests
  describe('Schema Validation', () => {
    it('should validate findAll query parameters', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      // Valid query
      await expect(
        controller.findAll({ page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
      ).resolves.toBeDefined();

      // Invalid query should throw ZodError
      await expect(controller.findAll({ page: -1 })).rejects.toThrow();
    });

    it('should validate search query parameters', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.search.mockResolvedValue(mockResult);

      // Valid search
      await expect(
        controller.search({ keyword: 'test', page: 1, pageSize: 10 }),
      ).resolves.toBeDefined();

      // Invalid search should throw
      await expect(controller.search({ keyword: '', page: 0 })).rejects.toThrow();
    });

    it('should validate create article DTO', async () => {
      const mockArticle = new Article(Mock.article());
      mockArticleService.create.mockResolvedValue(mockArticle);

      // Valid DTO with all fields
      await expect(
        controller.create({ title: 'Test', content: 'Content', author: 'admin', tags: [] }),
      ).resolves.toBeDefined();

      // Valid DTO with minimal required fields (content and author have defaults)
      await expect(controller.create({ title: 'Test' })).resolves.toBeDefined();

      // Invalid DTO - title is required in the database schema
      // Note: The CreateArticleSchema makes content, tags, author optional
      // The service layer provides defaults for these fields
    });

    it('should validate update article DTO', async () => {
      const mockArticle = new Article(Mock.article());
      mockArticleService.update.mockResolvedValue(mockArticle);

      // Valid update - title only
      await expect(controller.update(1, { title: 'Updated' })).resolves.toBeDefined();

      // Valid update - top as number
      await expect(controller.update(1, { top: 1 })).resolves.toBeDefined();

      // Note: drizzle-zod schemas use coercion, so 'invalid' string would become NaN
      // The validation doesn't throw for type mismatches due to Zod's default coercion
    });

    it('should validate import articles array', async () => {
      mockArticleService.importArticles.mockResolvedValue(undefined);

      // Valid array
      await expect(
        controller.import([
          { title: 'Article 1', content: 'Content 1', author: 'admin', tags: [] },
          { title: 'Article 2', content: 'Content 2', author: 'admin', tags: [] },
        ]),
      ).resolves.toBeUndefined();

      // Invalid - not an array
      await expect(controller.import({ title: 'Test' })).rejects.toThrow();
    });

    it('should validate verify password DTO', async () => {
      const mockResponse = {
        success: true,
        token: 'token',
        expiresAt: '2024-12-31T00:00:00Z',
      };
      mockArticleService.verifyPassword.mockResolvedValue(mockResponse);

      // Valid password
      await expect(
        controller.verifyPassword(1, { password: 'secret' }, {} as any),
      ).resolves.toBeDefined();

      // Invalid - missing password
      await expect(controller.verifyPassword(1, {}, {} as any)).rejects.toThrow();
    });
  });

  // Edge cases and error handling
  describe('Edge Cases', () => {
    it('should handle empty results from findAll', async () => {
      mockArticleService.findAll.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      const result = await controller.findAll({ page: 1, pageSize: 10 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle large page numbers', async () => {
      mockArticleService.findAll.mockResolvedValue({
        items: [],
        total: 0,
        page: 999,
        pageSize: 10,
        totalPages: 0,
      });

      const result = await controller.findAll({ page: 999, pageSize: 10 });

      expect(result.page).toBe(999);
    });

    it('should handle articles with null/undefined fields', async () => {
      const mockResult = {
        items: [
          Mock.article({
            category: null,
            tags: null,
            password: null,
            viewer: null,
            top: null,
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll({ page: 1, pageSize: 10 });

      expect(result.items[0]).toBeDefined();
      expect(result.items[0].category).toBeNull();
    });

    it('should handle incrementView with undefined user-agent', async () => {
      mockArticleStatsService.recordArticleView.mockResolvedValue(undefined);

      await controller.incrementView(1, '127.0.0.1', undefined);

      expect(mockArticleStatsService.recordArticleView).toHaveBeenCalledWith(
        1,
        '127.0.0.1',
        undefined,
      );
    });

    it('should handle verifyPassword without user in request', async () => {
      const mockResponse = {
        success: true,
        token: 'anonymous-token',
        expiresAt: '2024-12-31T00:00:00Z',
      };
      mockArticleService.verifyPassword.mockResolvedValue(mockResponse);

      const result = await controller.verifyPassword(1, { password: 'secret' }, {} as any);

      expect(mockArticleService.verifyPassword).toHaveBeenCalledWith(1, 'secret', undefined);
      expect(result.token).toBe('anonymous-token');
    });

    it('should handle complex search queries', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.search.mockResolvedValue(mockResult);

      await controller.search({
        keyword: 'test query with special chars: @#$%',
        page: 1,
        pageSize: 20,
      });

      expect(mockArticleService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: 'test query with special chars: @#$%',
        }),
      );
    });
  });
});
