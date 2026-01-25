import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { Mock } from '@test/mock';
import { createMockArticle } from '@test/fixtures/test-data';

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

  // ts-rest handlers
  describe('getAdminArticles (ts-rest)', () => {
    it('should return paginated articles for admin', async () => {
      const mockResult = {
        items: [
          Mock.article({
            id: 1,
            title: 'Admin Article',
            category: 'Tech',
            top: 1,
            viewer: 100,
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      const handler = controller.getAdminArticles();
      const result = await handler({ query: { page: 1, pageSize: 10 } });

      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(1);
      expect(result.body.items[0].title).toBe('Admin Article');
      expect(result.body.items[0].isTop).toBe(true);
      expect(result.body.items[0].views).toBe(100);
      expect(mockArticleService.findAll).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        category: undefined,
        tag: undefined,
        isTop: undefined,
        isPublished: undefined,
        includeHidden: true,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('should handle category filter', async () => {
      const mockResult = {
        items: [Mock.article({ category: 'Tech' })],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      const handler = controller.getAdminArticles();
      await handler({ query: { page: 1, pageSize: 10, category: 'Tech' } });

      expect(mockArticleService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Tech',
        }),
      );
    });

    it('should handle tag filter', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      const handler = controller.getAdminArticles();
      await handler({ query: { page: 1, pageSize: 10, tag: 'javascript' } });

      expect(mockArticleService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: 'javascript',
        }),
      );
    });

    it('should handle topping filter', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      const handler = controller.getAdminArticles();
      await handler({ query: { page: 1, pageSize: 10, topping: true } });

      expect(mockArticleService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          isTop: true,
        }),
      );
    });

    it('should handle hidden filter', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      const handler = controller.getAdminArticles();
      await handler({ query: { page: 1, pageSize: 10, hidden: true } });

      expect(mockArticleService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          isPublished: false,
        }),
      );
    });

    it('should map article fields correctly', async () => {
      const mockResult = {
        items: [
          Mock.article({
            id: 1,
            title: 'Test',
            content: 'Content',
            category: 'Tech',
            top: 5,
            viewer: null,
            private: true,
            password: 'secret',
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      const handler = controller.getAdminArticles();
      const result = await handler({ query: { page: 1, pageSize: 10 } });

      const [article] = result.body.items;
      expect(article.id).toBe(1);
      expect(article.title).toBe('Test');
      expect(article.content).toBe('Content');
      expect(article.category).toBe('Tech');
      expect(article.views).toBe(0);
      expect(article.likes).toBe(0);
      expect(article.isTop).toBe(true);
      expect(article.isHot).toBe(false);
      expect(article.private).toBe(true);
      expect(article.password).toBe('secret');
      expect(article.summary).toBeUndefined();
      expect(article.cover).toBeUndefined();
      expect(article.tags).toBeUndefined();
      expect(article.toc).toBeUndefined();
    });
  });

  describe('createArticleRest (ts-rest)', () => {
    it('should create article with username from request', async () => {
      const createDto = {
        title: 'New Article',
        content: 'Content',
        tags: ['test', 'javascript'],
      };
      const mockArticle = new Article(
        Mock.article({
          id: 1,
          title: 'New Article',
          content: 'Content',
        }),
      );
      mockArticleService.create.mockResolvedValue(mockArticle);

      const req = { user: { username: 'testuser' } } as any;
      const handler = controller.createArticleRest(req);
      const result = await handler({ body: createDto });

      expect(result.status).toBe(201);
      expect(result.body.title).toBe('New Article');
      expect(mockArticleService.create).toHaveBeenCalledWith({
        ...createDto,
        author: 'testuser',
        tags: ['test', 'javascript'],
      });
    });

    it('should default to admin when no username in request', async () => {
      const createDto = {
        title: 'New Article',
        content: 'Content',
      };
      const mockArticle = new Article(Mock.article(createDto));
      mockArticleService.create.mockResolvedValue(mockArticle);

      const req = {} as any;
      const handler = controller.createArticleRest(req);
      await handler({ body: createDto });

      expect(mockArticleService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          author: 'admin',
        }),
      );
    });

    it('should handle null tags', async () => {
      const createDto = {
        title: 'New Article',
        content: 'Content',
        tags: null,
      };
      const mockArticle = new Article(Mock.article(createDto));
      mockArticleService.create.mockResolvedValue(mockArticle);

      const req = {} as any;
      const handler = controller.createArticleRest(req);
      await handler({ body: createDto });

      expect(mockArticleService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: null,
        }),
      );
    });

    it('should map response correctly', async () => {
      const mockArticle = new Article(
        Mock.article({
          id: 1,
          title: 'Test',
          top: 2,
          viewer: 50,
          private: false,
          password: null,
        }),
      );
      mockArticleService.create.mockResolvedValue(mockArticle);

      const req = {} as any;
      const handler = controller.createArticleRest(req);
      const result = await handler({ body: { title: 'Test', content: 'Content' } });

      expect(result.body.isTop).toBe(true);
      expect(result.body.views).toBe(50);
      expect(result.body.likes).toBe(0);
      expect(result.body.private).toBe(false);
      expect(result.body.password).toBeUndefined();
    });
  });

  describe('updateArticleRest (ts-rest)', () => {
    it('should update article with array tags', async () => {
      const mockArticleData = createMockArticle();
      const updateDto = {
        title: 'Updated',
        tags: ['tag1', 'tag2'],
      };
      const mockArticle = new Article(
        Mock.article({
          id: mockArticleData.id,
          title: 'Updated',
        }),
      );
      mockArticleService.update.mockResolvedValue(mockArticle);

      const handler = controller.updateArticleRest();
      await handler({ params: { id: String(mockArticleData.id) }, body: updateDto });

      expect(mockArticleService.update).toHaveBeenCalledWith(
        mockArticleData.id,
        expect.objectContaining({
          title: 'Updated',
          tags: JSON.stringify(['tag1', 'tag2']),
        }),
      );
    });

    it('should update article with string tags', async () => {
      const mockArticleData = createMockArticle();
      const updateDto = {
        title: 'Updated',
        tags: '["tag1","tag2"]',
      };
      const mockArticle = new Article(createMockArticle({ id: mockArticleData.id }));
      mockArticleService.update.mockResolvedValue(mockArticle);

      const handler = controller.updateArticleRest();
      await handler({ params: { id: String(mockArticleData.id) }, body: updateDto });

      expect(mockArticleService.update).toHaveBeenCalledWith(
        mockArticleData.id,
        expect.objectContaining({
          tags: '["tag1","tag2"]',
        }),
      );
    });

    it('should update article without tags', async () => {
      const mockArticleData = createMockArticle();
      const updateDto = {
        title: 'Updated',
      };
      const mockArticle = new Article(createMockArticle({ id: mockArticleData.id }));
      mockArticleService.update.mockResolvedValue(mockArticle);

      const handler = controller.updateArticleRest();
      await handler({ params: { id: String(mockArticleData.id) }, body: updateDto });

      expect(mockArticleService.update).toHaveBeenCalledWith(
        mockArticleData.id,
        expect.objectContaining({
          title: 'Updated',
        }),
      );
      expect(mockArticleService.update.mock.calls[0][1]).not.toHaveProperty('tags');
    });

    it('should map response correctly', async () => {
      const mockArticleData = createMockArticle();
      const mockArticle = new Article(
        Mock.article({
          id: mockArticleData.id,
          top: 0,
          viewer: 100,
          private: true,
          password: 'secret',
        }),
      );
      mockArticleService.update.mockResolvedValue(mockArticle);

      const handler = controller.updateArticleRest();
      const result = await handler({
        params: { id: String(mockArticleData.id) },
        body: { title: 'Updated' },
      });

      expect(result.status).toBe(200);
      expect(result.body.isTop).toBe(false);
      expect(result.body.views).toBe(100);
      expect(result.body.private).toBe(true);
      expect(result.body.password).toBe('secret');
    });
  });

  describe('deleteArticleRest (ts-rest)', () => {
    it('should delete article and return success', async () => {
      const mockArticle = createMockArticle();
      mockArticleService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteArticleRest();
      const result = await handler({ params: { id: String(mockArticle.id) } });

      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
      expect(mockArticleService.remove).toHaveBeenCalledWith(mockArticle.id);
    });

    it('should convert string id to number', async () => {
      const mockArticle = createMockArticle();
      mockArticleService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteArticleRest();
      await handler({ params: { id: String(mockArticle.id) } });

      expect(mockArticleService.remove).toHaveBeenCalledWith(mockArticle.id);
    });
  });

  describe('getAdminArticleRest (ts-rest)', () => {
    it('should return single article for admin', async () => {
      const mockArticle = new Article(
        Mock.article({
          id: 1,
          title: 'Test Article',
          category: 'Tech',
          top: 1,
          viewer: 50,
          private: false,
          password: null,
        }),
      );
      mockArticleService.findOne.mockResolvedValue(mockArticle);

      const handler = controller.getAdminArticleRest();
      const result = await handler({ params: { id: String(mockArticle.id) } });

      expect(result.status).toBe(200);
      expect(result.body.id).toBe(1);
      expect(result.body.title).toBe('Test Article');
      expect(result.body.category).toBe('Tech');
      expect(result.body.isTop).toBe(true);
      expect(result.body.views).toBe(50);
      expect(mockArticleService.findOne).toHaveBeenCalledWith(mockArticle.id);
    });

    it('should map all fields correctly', async () => {
      const mockArticle = new Article(
        Mock.article({
          id: 1,
          top: null,
          viewer: null,
          category: null,
          private: true,
          password: 'encrypted',
        }),
      );
      mockArticleService.findOne.mockResolvedValue(mockArticle);

      const handler = controller.getAdminArticleRest();
      const result = await handler({ params: { id: String(mockArticle.id) } });

      expect(result.body.isTop).toBe(false);
      expect(result.body.views).toBeUndefined();
      expect(result.body.category).toBeUndefined();
      expect(result.body.private).toBe(true);
      expect(result.body.password).toBe('encrypted');
      expect(result.body.likes).toBe(0);
      expect(result.body.isHot).toBe(false);
      expect(result.body.summary).toBeUndefined();
      expect(result.body.cover).toBeUndefined();
      expect(result.body.tags).toBeUndefined();
      expect(result.body.toc).toBeUndefined();
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

      // Valid DTO
      await expect(
        controller.create({ title: 'Test', content: 'Content', author: 'admin', tags: [] }),
      ).resolves.toBeDefined();

      // Invalid DTO - missing required fields
      await expect(controller.create({ title: 'Test' })).rejects.toThrow();
    });

    it('should validate update article DTO', async () => {
      const mockArticle = new Article(Mock.article());
      mockArticleService.update.mockResolvedValue(mockArticle);

      // Valid update
      await expect(controller.update(1, { title: 'Updated' })).resolves.toBeDefined();

      // Invalid update - invalid field type
      await expect(controller.update(1, { top: 'invalid' })).rejects.toThrow();
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
