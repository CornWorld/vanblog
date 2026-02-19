import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { Mock } from '@test/mock';

import { ArticleStatsService } from '../analytics/services/article-stats.service';

import { PublicArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { Article } from './entities/article.entity';
import { ArticleAccessGuard } from './guards/article-access.guard';

describe('PublicArticleController', () => {
  let controller: PublicArticleController;
  let mockArticleService: any;
  let mockArticleStatsService: any;

  beforeEach(async () => {
    mockArticleService = Mock.articleService();
    mockArticleStatsService = Mock.articleStatsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicArticleController],
      providers: [
        { provide: ArticleService, useValue: mockArticleService },
        { provide: ArticleStatsService, useValue: mockArticleStatsService },
      ],
    })
      .overrideGuard(ArticleAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PublicArticleController>(PublicArticleController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should parse query and delegate to articleService.findAll', async () => {
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

    it('should apply default values when query is empty', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      await controller.findAll({});

      expect(mockArticleService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      );
    });

    it('should handle null raw input with defaults', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockArticleService.findAll.mockResolvedValue(mockResult);

      await controller.findAll(null as any);

      expect(mockArticleService.findAll).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should parse query and delegate to articleService.search', async () => {
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

    it('should reject empty keyword', async () => {
      await expect(controller.search({ keyword: '', page: 1, pageSize: 10 })).rejects.toThrow();
    });
  });

  describe('findByCategory', () => {
    it('should delegate to articleService.findByCategory', async () => {
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

  describe('findOneByPathname', () => {
    it('should delegate to articleService.findOneByPathname', async () => {
      const mockArticle = new Article(Mock.article({ pathname: 'test-post' }));
      mockArticleService.findOneByPathname.mockResolvedValue(mockArticle);

      const result = await controller.findOneByPathname('test-post');

      expect(mockArticleService.findOneByPathname).toHaveBeenCalledWith('test-post');
      expect(result).toEqual(mockArticle);
    });
  });

  describe('getArticlesGroupedByCategory', () => {
    it('should delegate to articleService.getArticlesGroupedByCategory', async () => {
      const mockGrouped = {
        Tech: [{ id: 1, title: 'Article 1', category: 'Tech' }],
        Life: [{ id: 2, title: 'Article 2', category: 'Life' }],
      };
      mockArticleService.getArticlesGroupedByCategory.mockResolvedValue(mockGrouped);

      const result = await controller.getArticlesGroupedByCategory();

      expect(mockArticleService.getArticlesGroupedByCategory).toHaveBeenCalled();
      expect(result).toEqual(mockGrouped);
    });

    it('should return empty object when no categories', async () => {
      mockArticleService.getArticlesGroupedByCategory.mockResolvedValue({});

      const result = await controller.getArticlesGroupedByCategory();

      expect(result).toEqual({});
    });
  });

  describe('getArticlesGroupedByTag', () => {
    it('should delegate to articleService.getArticlesGroupedByTag', async () => {
      const mockGrouped = {
        javascript: [{ id: 1, title: 'JS Article', tags: ['javascript'] }],
        typescript: [{ id: 2, title: 'TS Article', tags: ['typescript'] }],
      };
      mockArticleService.getArticlesGroupedByTag.mockResolvedValue(mockGrouped);

      const result = await controller.getArticlesGroupedByTag();

      expect(mockArticleService.getArticlesGroupedByTag).toHaveBeenCalled();
      expect(result).toEqual(mockGrouped);
    });

    it('should return empty object when no tags', async () => {
      mockArticleService.getArticlesGroupedByTag.mockResolvedValue({});

      const result = await controller.getArticlesGroupedByTag();

      expect(result).toEqual({});
    });
  });

  describe('findOne', () => {
    it('should delegate to articleService.findOne', async () => {
      const mockArticle = new Article(Mock.article({ id: 1 }));
      mockArticleService.findOne.mockResolvedValue(mockArticle);

      const result = await controller.findOne(1);

      expect(mockArticleService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockArticle);
    });
  });

  describe('incrementView', () => {
    it('should delegate to articleStatsService.recordArticleView', async () => {
      mockArticleStatsService.recordArticleView.mockResolvedValue(undefined);

      await controller.incrementView(1, '127.0.0.1', 'Mozilla/5.0');

      expect(mockArticleStatsService.recordArticleView).toHaveBeenCalledWith(
        1,
        '127.0.0.1',
        'Mozilla/5.0',
      );
    });

    it('should handle undefined user-agent', async () => {
      mockArticleStatsService.recordArticleView.mockResolvedValue(undefined);

      await controller.incrementView(1, '127.0.0.1', undefined);

      expect(mockArticleStatsService.recordArticleView).toHaveBeenCalledWith(
        1,
        '127.0.0.1',
        undefined,
      );
    });
  });

  describe('incrementViewByPathname', () => {
    it('should delegate to articleStatsService.recordArticleViewByPathname', async () => {
      mockArticleStatsService.recordArticleViewByPathname.mockResolvedValue(undefined);

      await controller.incrementViewByPathname('hello-world', '127.0.0.1', 'Mozilla/5.0');

      expect(mockArticleStatsService.recordArticleViewByPathname).toHaveBeenCalledWith(
        'hello-world',
        '127.0.0.1',
        'Mozilla/5.0',
      );
    });

    it('should handle undefined user-agent', async () => {
      mockArticleStatsService.recordArticleViewByPathname.mockResolvedValue(undefined);

      await controller.incrementViewByPathname('hello-world', '192.168.1.1', undefined);

      expect(mockArticleStatsService.recordArticleViewByPathname).toHaveBeenCalledWith(
        'hello-world',
        '192.168.1.1',
        undefined,
      );
    });
  });

  describe('verifyPassword', () => {
    it('should parse body and delegate to articleService.verifyPassword', async () => {
      const response = { success: true, token: 'tok', expiresAt: '2025-12-31T00:00:00Z' };
      mockArticleService.verifyPassword.mockResolvedValue(response);

      const result = await controller.verifyPassword(1, { password: 'secret' }, {} as any);

      expect(mockArticleService.verifyPassword).toHaveBeenCalledWith(1, 'secret', undefined);
      expect(result).toBe(response);
    });

    it('should pass user id when user is authenticated', async () => {
      const response = { success: true, token: 'tok', expiresAt: '2025-12-31T00:00:00Z' };
      mockArticleService.verifyPassword.mockResolvedValue(response);

      await controller.verifyPassword(1, { password: 'secret' }, { user: { id: 42 } } as any);

      expect(mockArticleService.verifyPassword).toHaveBeenCalledWith(1, 'secret', 42);
    });

    it('should reject missing password', async () => {
      await expect(controller.verifyPassword(1, {}, {} as any)).rejects.toThrow();
    });
  });

  describe('verifyPasswordByPathname', () => {
    it('should parse body and delegate to articleService.verifyPasswordByPathname', async () => {
      const response = { success: true, token: 'tok', expiresAt: '2025-12-31T00:00:00Z' };
      mockArticleService.verifyPasswordByPathname.mockResolvedValue(response);

      const result = await controller.verifyPasswordByPathname(
        'test-article',
        { password: 'secret' },
        {} as any,
      );

      expect(mockArticleService.verifyPasswordByPathname).toHaveBeenCalledWith(
        'test-article',
        'secret',
        undefined,
      );
      expect(result).toBe(response);
    });

    it('should pass user id when user is authenticated', async () => {
      const response = { success: true, token: 'tok', expiresAt: '2025-12-31T00:00:00Z' };
      mockArticleService.verifyPasswordByPathname.mockResolvedValue(response);

      await controller.verifyPasswordByPathname('test-article', { password: 'secret' }, {
        user: { id: 99 },
      } as any);

      expect(mockArticleService.verifyPasswordByPathname).toHaveBeenCalledWith(
        'test-article',
        'secret',
        99,
      );
    });

    it('should reject missing password', async () => {
      await expect(
        controller.verifyPasswordByPathname('test-article', {}, {} as any),
      ).rejects.toThrow();
    });
  });
});
