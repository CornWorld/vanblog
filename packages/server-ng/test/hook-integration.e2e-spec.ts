import { type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { ArticleService } from '../src/modules/article/article.service';
import { CommentService } from '../src/modules/comment/comment.service';
import { DraftService } from '../src/modules/draft/draft.service';
import { HookService } from '../src/modules/plugin/services/hook.service';

import { cleanupDatabase, createTestApp } from './test-utils';

import type { INestApplication } from '@nestjs/common';

describe('Hook Integration (e2e)', () => {
  let app: INestApplication;
  let hookService: HookService;
  let articleService: ArticleService;
  let draftService: DraftService;
  let commentService: CommentService;

  beforeAll(async () => {
    app = await createTestApp();

    // Get services from the app
    hookService = app.get<HookService>(HookService);
    articleService = app.get<ArticleService>(ArticleService);
    draftService = app.get<DraftService>(DraftService);
    commentService = app.get<CommentService>(CommentService);
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
    it('should trigger article|beforeCreate filter hook', async () => {
      const mockFilter = vi.fn((data: Record<string, unknown>) => ({
        ...data,
        title: 'Modified Title',
      }));
      hookService.addFilter('article|beforeCreate', mockFilter);

      const createArticleDto = {
        title: 'Original Title',
        content: 'Test content',
        tags: ['test'],
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

    it('should trigger article|afterCreate action hook', async () => {
      const mockAction = vi.fn();
      hookService.addAction('article|afterCreate', mockAction);

      const createArticleDto = {
        title: 'Test Article',
        content: 'Test content',
        tags: ['test'],
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

    it('should trigger article|beforeUpdate filter hook', async () => {
      // First create an article
      const createArticleDto = {
        title: 'Original Article',
        content: 'Original content',
        tags: ['test'],
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
      hookService.addFilter('article|beforeUpdate', mockFilter);

      const updateArticleDto = {
        title: 'Updated Title',
        content: 'Updated content',
        tags: ['updated'],
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

    it('should trigger article|beforeDelete and article|afterDelete hooks', async () => {
      // First create an article
      const createArticleDto = {
        title: 'Article to Delete',
        content: 'Content to delete',
        tags: ['test'],
        categories: 'tech',
        pathname: 'article-to-delete',
        author: 'admin',
      };
      const createdArticle = await articleService.create(createArticleDto);

      // Add hooks
      const beforeDeleteAction = vi.fn();
      const afterDeleteAction = vi.fn();
      hookService.addAction('article|beforeDelete', beforeDeleteAction);
      hookService.addAction('article|afterDelete', afterDeleteAction);

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
    it('should trigger draft|beforeCreate filter hook', async () => {
      const mockFilter = vi.fn((data: Record<string, unknown>) => ({
        ...data,
        title: 'Modified Draft Title',
      }));
      hookService.addFilter('draft|beforeCreate', mockFilter);

      const createDraftDto = {
        title: 'Original Draft Title',
        content: 'Test draft content',
        tags: ['draft'],
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

    it('should trigger draft|afterCreate action hook', async () => {
      const mockAction = vi.fn();
      hookService.addAction('draft|afterCreate', mockAction);

      const createDraftDto = {
        title: 'Test Draft',
        content: 'Test draft content',
        tags: ['draft'],
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

    it('should trigger draft|beforeUpdate filter hook', async () => {
      // First create a draft
      const createDraftDto = {
        title: 'Original Draft',
        content: 'Original draft content',
        tags: ['draft'],
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
      hookService.addFilter('draft|beforeUpdate', mockFilter);

      const updateDraftDto = {
        title: 'Updated Draft Title',
        content: 'Updated draft content',
        tags: ['updated'],
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

    it('should trigger draft|beforeDelete and draft|afterDelete hooks', async () => {
      // First create a draft
      const createDraftDto = {
        title: 'Draft to Delete',
        content: 'Draft content to delete',
        tags: ['draft'],
        author: 'admin',
      };
      const createdDraft = await draftService.create(createDraftDto);

      // Add hooks
      const beforeDeleteAction = vi.fn();
      const afterDeleteAction = vi.fn();
      hookService.addAction('draft|beforeDelete', beforeDeleteAction);
      hookService.addAction('draft|afterDelete', afterDeleteAction);

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
      const actionId = hookService.addAction('test|action', mockAction);
      const filterId = hookService.addFilter('test|filter', mockFilter);

      expect(hookService.hasAction('test|action')).toBe(true);
      expect(hookService.hasFilter('test|filter')).toBe(true);
      expect(hookService.getActionCount('test|action')).toBe(1);
      expect(hookService.getFilterCount('test|filter')).toBe(1);

      // Remove hooks using their IDs
      const actionRemoved = hookService.removeAction('test|action', actionId);
      const filterRemoved = hookService.removeFilter('test|filter', filterId);

      expect(actionRemoved).toBe(true);
      expect(filterRemoved).toBe(true);
      expect(hookService.getActionCount('test|action')).toBe(0);
      expect(hookService.getFilterCount('test|filter')).toBe(0);
    });

    it('should handle multiple hooks for the same event', async () => {
      const mockFilter1 = vi.fn(
        (data: Record<string, unknown>): Record<string, unknown> => ({ ...data, modified1: true }),
      );
      const mockFilter2 = vi.fn(
        (data: Record<string, unknown>): Record<string, unknown> => ({ ...data, modified2: true }),
      );

      hookService.addFilter('article|beforeCreate', mockFilter1);
      hookService.addFilter('article|beforeCreate', mockFilter2);

      const createArticleDto = {
        title: 'Multi Hook Test',
        content: 'Test content',
        tags: ['test'],
        categories: 'tech',
        pathname: 'multi-hook-test',
        author: 'admin',
      };

      await articleService.create(createArticleDto);

      expect(mockFilter1).toHaveBeenCalled();
      expect(mockFilter2).toHaveBeenCalled();
      expect(hookService.getFilterCount('article|beforeCreate')).toBe(2);
    }, 15000);
  });

  describe('Comment Hook Integration', () => {
    it('should trigger comment|beforeUpdate filter hook', async () => {
      const mockFilter = vi.fn((data: Record<string, unknown>) => ({
        ...data,
        'sender.name': 'Modified Sender',
      }));
      hookService.addFilter('comment|beforeUpdate', mockFilter);

      const updateData = {
        'smtp.enabled': true,
        'sender.name': 'Original Sender',
      };

      // Mock restart to avoid actual process operations
      vi.spyOn(commentService, 'restart').mockResolvedValue();

      await commentService.updateWalineSetting(updateData);

      expect(mockFilter).toHaveBeenCalledWith(
        updateData,
        expect.objectContaining({
          action: 'update',
          existing: expect.any(Object),
        }),
      );
    });

    it('should trigger comment|afterUpdate action hook', async () => {
      const mockAction = vi.fn();
      hookService.addAction('comment|afterUpdate', mockAction);

      const updateData = {
        'smtp.enabled': false,
        'sender.name': 'Test Sender',
      };

      // Mock restart to avoid actual process operations
      vi.spyOn(commentService, 'restart').mockResolvedValue();

      await commentService.updateWalineSetting(updateData);

      expect(mockAction).toHaveBeenCalledWith(
        expect.objectContaining({
          'smtp.enabled': false,
          'sender.name': 'Test Sender',
        }),
        expect.objectContaining({
          action: 'update',
          previous: expect.any(Object),
          changes: expect.any(Object),
        }),
      );
    });

    // Note: restart hooks are tested in unit tests (comment.service.spec.ts)
    // E2E testing of restart hooks is complex due to process mocking requirements
  });
});
