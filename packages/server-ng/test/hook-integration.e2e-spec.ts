import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HookService } from '../src/modules/plugin/services/hook.service';
import { ArticleService } from '../src/modules/article/article.service';
import { DraftService } from '../src/modules/draft/draft.service';
import { cleanupDatabase } from './test-utils';

describe('Hook Integration (e2e)', () => {
  let app: INestApplication;
  let hookService: HookService;
  let articleService: ArticleService;
  let draftService: DraftService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    hookService = moduleFixture.get<HookService>(HookService);
    articleService = moduleFixture.get<ArticleService>(ArticleService);
    draftService = moduleFixture.get<DraftService>(DraftService);

    await app.init();
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  beforeEach(async () => {
    // Clear all hooks before each test
    hookService.clearAllHooks();
    // Clean database before each test to avoid conflicts
    await cleanupDatabase(app);
  });

  describe('Article Hook Integration', () => {
    it('should trigger beforeCreateArticle filter hook', async () => {
      const mockFilter = vi.fn((data) => ({ ...data, title: 'Modified Title' }));
      hookService.addFilter('beforeCreateArticle', mockFilter);

      const createArticleDto = {
        title: 'Original Title',
        content: 'Test content',
        tags: 'test',
        categories: 'tech',
        pathname: 'test-article',
        author: 'admin',
      };

      const result = await articleService.create(createArticleDto);

      expect(mockFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Original Title',
          content: 'Test content',
        }),
        { action: 'create' },
      );
      expect(result.title).toBe('Modified Title');
    });

    it('should trigger afterCreateArticle action hook', async () => {
      const mockAction = vi.fn();
      hookService.addAction('afterCreateArticle', mockAction);

      const createArticleDto = {
        title: 'Test Article',
        content: 'Test content',
        tags: 'test',
        categories: 'tech',
        pathname: 'test-article-2',
        author: 'admin',
      };

      await articleService.create(createArticleDto);

      expect(mockAction).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Article',
          content: 'Test content',
        }),
        { action: 'create' },
      );
    });

    it('should trigger beforeUpdateArticle filter hook', async () => {
      // First create an article
      const createArticleDto = {
        title: 'Original Article',
        content: 'Original content',
        tags: 'test',
        categories: 'tech',
        pathname: 'original-article',
        author: 'admin',
      };
      const createdArticle = await articleService.create(createArticleDto);

      // Add hook
      const mockFilter = vi.fn(
        (data: Record<string, unknown>): Record<string, unknown> => ({
          ...data,
          content: 'Modified Content',
        }),
      );
      hookService.addFilter('beforeUpdateArticle', mockFilter);

      const updateArticleDto = {
        title: 'Updated Title',
        content: 'Updated content',
        tags: 'updated',
      };

      const result = await articleService.update(createdArticle.id, updateArticleDto);

      expect(mockFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
          content: 'Updated content',
        }),
        { action: 'update', id: createdArticle.id },
      );
      expect(result.content).toBe('Modified Content');
    }, 15000);

    it('should trigger beforeDeleteArticle and afterDeleteArticle hooks', async () => {
      // First create an article
      const createArticleDto = {
        title: 'Article to Delete',
        content: 'Content to delete',
        tags: 'test',
        categories: 'tech',
        pathname: 'article-to-delete',
        author: 'admin',
      };
      const createdArticle = await articleService.create(createArticleDto);

      // Add hooks
      const beforeDeleteAction = vi.fn();
      const afterDeleteAction = vi.fn();
      hookService.addAction('beforeDeleteArticle', beforeDeleteAction);
      hookService.addAction('afterDeleteArticle', afterDeleteAction);

      await articleService.remove(createdArticle.id);

      expect(beforeDeleteAction).toHaveBeenCalledWith(
        { id: createdArticle.id },
        { action: 'delete' },
      );
      expect(afterDeleteAction).toHaveBeenCalledWith(
        { id: createdArticle.id },
        { action: 'delete' },
      );
    }, 15000);
  });

  describe('Draft Hook Integration', () => {
    it('should trigger beforeCreateDraft filter hook', async () => {
      const mockFilter = vi.fn((data) => ({ ...data, title: 'Modified Draft Title' }));
      hookService.addFilter('beforeCreateDraft', mockFilter);

      const createDraftDto = {
        title: 'Original Draft Title',
        content: 'Test draft content',
        tags: 'draft',
        author: 'admin',
      };

      const result = await draftService.create(createDraftDto);

      expect(mockFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Original Draft Title',
          content: 'Test draft content',
        }),
        { action: 'create' },
      );
      expect(result.title).toBe('Modified Draft Title');
    });

    it('should trigger afterCreateDraft action hook', async () => {
      const mockAction = vi.fn();
      hookService.addAction('afterCreateDraft', mockAction);

      const createDraftDto = {
        title: 'Test Draft',
        content: 'Test draft content',
        tags: 'draft',
        author: 'admin',
      };

      await draftService.create(createDraftDto);

      expect(mockAction).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Draft',
          content: 'Test draft content',
        }),
        { action: 'create' },
      );
    });

    it('should trigger beforeUpdateDraft filter hook', async () => {
      // First create a draft
      const createDraftDto = {
        title: 'Original Draft',
        content: 'Original draft content',
        tags: 'draft',
        author: 'admin',
      };
      const createdDraft = await draftService.create(createDraftDto);

      // Add hook
      const mockFilter = vi.fn(
        (data: Record<string, unknown>): Record<string, unknown> => ({
          ...data,
          content: 'Modified Draft Content',
        }),
      );
      hookService.addFilter('beforeUpdateDraft', mockFilter);

      const updateDraftDto = {
        title: 'Updated Draft Title',
        content: 'Updated draft content',
        tags: 'updated',
      };

      const result = await draftService.update(createdDraft.id, updateDraftDto);

      expect(mockFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Draft Title',
          content: 'Updated draft content',
        }),
        { action: 'update', id: createdDraft.id },
      );
      expect(result.content).toBe('Modified Draft Content');
    }, 15000);

    it('should trigger beforeDeleteDraft and afterDeleteDraft hooks', async () => {
      // First create a draft
      const createDraftDto = {
        title: 'Draft to Delete',
        content: 'Draft content to delete',
        tags: 'draft',
        author: 'admin',
      };
      const createdDraft = await draftService.create(createDraftDto);

      // Add hooks
      const beforeDeleteAction = vi.fn();
      const afterDeleteAction = vi.fn();
      hookService.addAction('beforeDeleteDraft', beforeDeleteAction);
      hookService.addAction('afterDeleteDraft', afterDeleteAction);

      await draftService.remove(createdDraft.id);

      expect(beforeDeleteAction).toHaveBeenCalledWith(
        { id: createdDraft.id },
        { action: 'delete' },
      );
      expect(afterDeleteAction).toHaveBeenCalledWith({ id: createdDraft.id }, { action: 'delete' });
    }, 15000);
  });

  describe('Hook Service Management', () => {
    it('should allow adding and removing hooks', () => {
      const mockAction = vi.fn();
      const mockFilter = vi.fn((data: unknown) => data);

      // Add hooks and get their IDs
      const actionId = hookService.addAction('testAction', mockAction);
      const filterId = hookService.addFilter('testFilter', mockFilter);

      expect(hookService.hasAction('testAction')).toBe(true);
      expect(hookService.hasFilter('testFilter')).toBe(true);
      expect(hookService.getActionCount('testAction')).toBe(1);
      expect(hookService.getFilterCount('testFilter')).toBe(1);

      // Remove hooks using their IDs
      const actionRemoved = hookService.removeAction('testAction', actionId);
      const filterRemoved = hookService.removeFilter('testFilter', filterId);

      expect(actionRemoved).toBe(true);
      expect(filterRemoved).toBe(true);
      expect(hookService.getActionCount('testAction')).toBe(0);
      expect(hookService.getFilterCount('testFilter')).toBe(0);
    });

    it('should handle multiple hooks for the same event', async () => {
      const mockFilter1 = vi.fn(
        (data: Record<string, unknown>): Record<string, unknown> => ({ ...data, modified1: true }),
      );
      const mockFilter2 = vi.fn(
        (data: Record<string, unknown>): Record<string, unknown> => ({ ...data, modified2: true }),
      );

      hookService.addFilter('beforeCreateArticle', mockFilter1);
      hookService.addFilter('beforeCreateArticle', mockFilter2);

      const createArticleDto = {
        title: 'Multi Hook Test',
        content: 'Test content',
        tags: 'test',
        categories: 'tech',
        pathname: 'multi-hook-test',
        author: 'admin',
      };

      await articleService.create(createArticleDto);

      expect(mockFilter1).toHaveBeenCalled();
      expect(mockFilter2).toHaveBeenCalled();
      expect(hookService.getFilterCount('beforeCreateArticle')).toBe(2);
    }, 15000);
  });
});
