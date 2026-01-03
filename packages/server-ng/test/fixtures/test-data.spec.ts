/**
 * Test Data Factories - Verification Tests
 *
 * These tests ensure all factory functions work correctly and produce valid data
 */

import { describe, it, expect } from 'vitest';
import { dayjs } from '@vanblog/shared';

import {
  createMockUser,
  createMockArticle,
  createMockTag,
  createMockCategory,
  createMockDraft,
  createMockDraftVersion,
  createMockMedia,
  createMockWebhook,
  createMockWebhookLog,
  createMockAnalytics,
  createMockSetting,
  createMockComment,
  createMockLoginLog,
  createMockCustomPage,
  createMockPermissionNode,
  createMockPermissionGroup,
  createMockPluginData,
  createMockPluginMetadata,
  createMockImageProcessingQueue,
  createMockTokenBlacklist,
  createMockPipeline,
  createMockArticles,
  createMockTags,
  createMockCategories,
  createMockUsers,
  createMockMediaFiles,
} from './test-data';

describe('Test Data Factories', () => {
  describe('Core Entities', () => {
    it('should create mock user with defaults', () => {
      const user = createMockUser();

      expect(user).toMatchObject({
        id: 1,
        username: 'testuser',
        type: 'admin',
        email: 'test@example.com',
      });
      expect(user.createdAt).toBeTruthy();
      expect(user.updatedAt).toBeTruthy();
    });

    it('should create mock user with overrides', () => {
      const user = createMockUser({
        username: 'customuser',
        type: 'editor',
        email: 'custom@example.com',
      });

      expect(user.username).toBe('customuser');
      expect(user.type).toBe('editor');
      expect(user.email).toBe('custom@example.com');
    });

    it('should create mock article with defaults', () => {
      const article = createMockArticle();

      expect(article).toMatchObject({
        id: 1,
        title: 'Test Article',
        author: 'admin',
        hidden: false,
        private: false,
      });
      expect(article.tags).toEqual(['test', 'demo']);
    });

    it('should create mock article with overrides', () => {
      const article = createMockArticle({
        title: 'Custom Title',
        viewer: 100,
        hidden: true,
      });

      expect(article.title).toBe('Custom Title');
      expect(article.viewer).toBe(100);
      expect(article.hidden).toBe(true);
    });

    it('should create mock tag', () => {
      const tag = createMockTag({ name: 'JavaScript' });

      expect(tag.name).toBe('JavaScript');
      expect(tag.id).toBe(1);
    });

    it('should create mock category', () => {
      const category = createMockCategory({ name: 'Tech' });

      expect(category.name).toBe('Tech');
      expect(category.private).toBe(false);
    });

    it('should create mock draft', () => {
      const draft = createMockDraft();

      expect(draft).toMatchObject({
        id: 1,
        title: 'Test Draft',
        version: 1,
        author: 'admin',
      });
    });

    it('should create mock draft version', () => {
      const version = createMockDraftVersion({ draftId: 5, version: 3 });

      expect(version.draftId).toBe(5);
      expect(version.version).toBe(3);
    });
  });

  describe('Media & Files', () => {
    it('should create mock media', () => {
      const media = createMockMedia();

      expect(media).toMatchObject({
        id: 1,
        filename: 'test-image.jpg',
        mimeType: 'image/jpeg',
        provider: 'local',
      });
      expect(media.size).toBe(102400);
    });

    it('should create mock media with custom properties', () => {
      const media = createMockMedia({
        filename: 'avatar.png',
        mimeType: 'image/png',
        width: 256,
        height: 256,
      });

      expect(media.filename).toBe('avatar.png');
      expect(media.mimeType).toBe('image/png');
      expect(media.width).toBe(256);
    });
  });

  describe('System & Settings', () => {
    it('should create mock setting', () => {
      const setting = createMockSetting({
        key: 'site.description',
        value: 'My awesome blog',
      });

      expect(setting.key).toBe('site.description');
      expect(setting.value).toBe('My awesome blog');
    });

    it('should create mock analytics', () => {
      const analytics = createMockAnalytics();

      expect(analytics.type).toBe('page_view');
      expect(analytics.path).toBe('/article/test-article');
    });

    it('should create mock login log', () => {
      const log = createMockLoginLog({ success: false, message: 'Invalid password' });

      expect(log.success).toBe(false);
      expect(log.message).toBe('Invalid password');
    });

    it('should create mock custom page', () => {
      const page = createMockCustomPage();

      expect(page.type).toBe('markdown');
      expect(page.pathname).toBe('/about');
    });
  });

  describe('Webhooks', () => {
    it('should create mock webhook', () => {
      const webhook = createMockWebhook();

      expect(webhook).toMatchObject({
        id: 1,
        name: 'Test Webhook',
        active: true,
        retryCount: 3,
      });
      expect(webhook.events).toContain('article|afterCreate');
    });

    it('should create mock webhook log', () => {
      const log = createMockWebhookLog();

      expect(log.status).toBe('success');
      expect(log.responseCode).toBe(200);
    });
  });

  describe('Permissions', () => {
    it('should create mock permission node', () => {
      const node = createMockPermissionNode();

      expect(node.name).toBe('article:create');
      expect(node.module).toBe('article');
      expect(node.isActive).toBe(true);
    });

    it('should create mock permission group', () => {
      const group = createMockPermissionGroup();

      expect(group.name).toBe('editors');
      expect(group.permissions).toContain('article:create');
    });
  });

  describe('Plugins', () => {
    it('should create mock plugin data', () => {
      const data = createMockPluginData();

      expect(data.pluginId).toBe('test-plugin');
      expect(data.key).toBe('config.enabled');
    });

    it('should create mock plugin metadata', () => {
      const metadata = createMockPluginMetadata();

      expect(metadata).toMatchObject({
        pluginId: 'test-plugin',
        entityType: 'article',
        entityId: 1,
      });
    });
  });

  describe('Other Entities', () => {
    it('should create mock comment', () => {
      const comment = createMockComment();

      expect(comment.status).toBe('approved');
      expect(comment.articleId).toBe(1);
    });

    it('should create mock image processing queue', () => {
      const queue = createMockImageProcessingQueue();

      expect(queue.status).toBe('pending');
      expect(queue.attempts).toBe(0);
      expect(queue.maxAttempts).toBe(3);
    });

    it('should create mock token blacklist', () => {
      const token = createMockTokenBlacklist();

      expect(token.tokenType).toBe('access');
      expect(token.userId).toBe(1);
    });

    it('should create mock pipeline', () => {
      const pipeline = createMockPipeline();

      expect(pipeline).toMatchObject({
        name: 'Test Pipeline',
        enabled: true,
        status: 'idle',
      });
    });
  });

  describe('Batch Creation Helpers', () => {
    it('should create multiple articles', () => {
      const articles = createMockArticles(5);

      expect(articles).toHaveLength(5);
      expect(articles[0].id).toBe(1);
      expect(articles[0].title).toBe('Test Article 1');
      expect(articles[4].id).toBe(5);
      expect(articles[4].title).toBe('Test Article 5');
    });

    it('should create multiple tags', () => {
      const tags = createMockTags(3);

      expect(tags).toHaveLength(3);
      expect(tags[0].name).toBe('Tag 1');
      expect(tags[2].slug).toBe('tag-3');
    });

    it('should create multiple categories', () => {
      const categories = createMockCategories(4);

      expect(categories).toHaveLength(4);
      expect(categories[1].name).toBe('Category 2');
    });

    it('should create multiple users', () => {
      const users = createMockUsers(10);

      expect(users).toHaveLength(10);
      expect(users[0].username).toBe('user1');
      expect(users[9].email).toBe('user10@example.com');
    });

    it('should create multiple media files', () => {
      const files = createMockMediaFiles(7);

      expect(files).toHaveLength(7);
      expect(files[3].filename).toBe('image-4.jpg');
    });

    it('should apply overrides to batch created items', () => {
      const articles = createMockArticles(3, {
        author: 'batch-author',
        hidden: true,
      });

      expect(articles).toHaveLength(3);
      articles.forEach((article) => {
        expect(article.author).toBe('batch-author');
        expect(article.hidden).toBe(true);
      });
    });
  });

  describe('Date Handling', () => {
    it('should use dayjs format for dates', () => {
      const article = createMockArticle();

      // Should be ISO 8601 format
      expect(article.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(dayjs(article.createdAt).isValid()).toBe(true);
    });

    it('should allow custom dates', () => {
      const customDate = dayjs('2023-06-15').format();
      const article = createMockArticle({
        createdAt: customDate,
      });

      expect(article.createdAt).toBe(customDate);
    });
  });

  describe('Type Safety', () => {
    it('should preserve all required fields', () => {
      const user = createMockUser();

      // All required User fields should be present
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('password');
      expect(user).toHaveProperty('type');
      expect(user).toHaveProperty('createdAt');
      expect(user).toHaveProperty('updatedAt');
    });

    it('should handle nullable fields', () => {
      const article = createMockArticle();

      expect(article.pathname).toBeNull();
      expect(article.category).toBeNull();
      expect(article.password).toBeNull();
    });

    it('should handle array fields', () => {
      const article = createMockArticle();

      expect(Array.isArray(article.tags)).toBe(true);
      expect(article.tags).toHaveLength(2);
    });
  });
});
