import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { ArticleStatsService } from '../analytics/services/article-stats.service';

import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { ArticleAccessGuard } from './guards/article-access.guard';

// Mocks
const mockArticleService = {
  update: vi.fn(),
  remove: vi.fn(),
  verifyPassword: vi.fn(),
  getArticlesGroupedByCategory: vi.fn(),
  getArticlesGroupedByTag: vi.fn(),
};

const mockArticleStatsService = {
  recordArticleView: vi.fn(),
  recordArticleViewByPathname: vi.fn(),
};

describe('ArticleController', () => {
  let controller: ArticleController;

  beforeEach(async () => {
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

  describe('update', () => {
    it('should delegate to articleService.update and return value', async () => {
      const id = 1;
      const dto = { title: 't' } as any;
      const updated = { id, title: 't' } as any;
      mockArticleService.update.mockResolvedValue(updated);

      const result = await controller.update(id, dto);

      expect(mockArticleService.update).toHaveBeenCalledWith(id, dto);
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
});
