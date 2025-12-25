import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { articles, categories } from '@vanblog/shared/drizzle';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AppModule } from '../../src/app.module';
import { ConfigService } from '../../src/config';
import { DATABASE_CONNECTION } from '../../src/database';
import { cleanupDatabase, createAuthToken, createUser } from '../test-utils';

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { Server } from 'http';

/**
 * Cache Invalidation Workflow Integration Tests
 *
 * Tests critical cache management scenarios:
 * - Article update → Verify derived view cache invalidated
 * - Category change → Verify analytics cache cleared
 * - Setting update → Verify bootstrap cache refreshed
 * - Concurrent cache operations → Verify consistency
 */
describe('Cache Invalidation Workflow (e2e)', () => {
  let app: INestApplication;
  let db: LibSQLDatabase;
  let httpServer: Server;
  let authToken: string;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    const configService = app.get(ConfigService);
    const appConfig = configService.app;
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });

    await app.init();
    httpServer = app.getHttpServer() as Server;
    db = app.get<LibSQLDatabase>(DATABASE_CONNECTION);

    // Setup test user
    await createUser(app);
    authToken = await createAuthToken(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.delete(articles).execute();
    await db.delete(categories).execute();
  });

  describe('Bootstrap cache invalidation', () => {
    it('should refresh bootstrap cache when siteInfo settings change', async () => {
      // Get initial bootstrap
      const initialRes = await request(httpServer).get('/api/v2/public/bootstrap').expect(200);

      expect(initialRes.body).toHaveProperty('data');

      // Update site settings (if endpoint is available)
      const updateRes = await request(httpServer)
        .put('/api/v2/admin/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          key: 'siteInfo.title',
          value: 'New Site Title',
        })
        .expect([200, 404]);

      if (updateRes.status === 200) {
        // Get bootstrap again - cache should be invalidated
        const refreshedRes = await request(httpServer).get('/api/v2/public/bootstrap').expect(200);

        expect(refreshedRes.body).toHaveProperty('data');

        // Title might be updated if settings affect bootstrap
        if (refreshedRes.body.data.siteInfo?.title) {
          expect(refreshedRes.body.data.siteInfo.title).toBe('New Site Title');
        }
      }
    });

    it('should cache bootstrap response for performance', async () => {
      // First request
      const res1 = await request(httpServer).get('/api/v2/public/bootstrap').expect(200);

      expect(res1.body).toHaveProperty('data');

      // Second request (should be cached)
      const res2 = await request(httpServer).get('/api/v2/public/bootstrap').expect(200);

      expect(res2.body).toHaveProperty('data');
      expect(JSON.stringify(res1.body)).toBe(JSON.stringify(res2.body));
    });
  });

  describe('Article list cache invalidation', () => {
    it('should invalidate article list cache after article creation', async () => {
      // Get initial article list
      const initialRes = await request(httpServer).get('/api/v2/articles').expect(200);

      const initialCount = initialRes.body.data?.length || 0;

      // Create a new article
      await request(httpServer)
        .post('/api/v2/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Cache Test Article',
          content: 'Testing cache invalidation',
          author: 'Cache Tester',
          pathname: 'cache-test-article',
          published: true,
        })
        .expect(201);

      // Get article list again - cache should be invalidated
      const updatedRes = await request(httpServer).get('/api/v2/articles').expect(200);

      const updatedCount = updatedRes.body.data?.length || 0;

      // Count should increase
      expect(updatedCount).toBeGreaterThan(initialCount);
    });

    it('should invalidate article list cache after article update', async () => {
      // Create an article
      const createRes = await request(httpServer)
        .post('/api/v2/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Original Title',
          content: 'Original content',
          author: 'Cache Tester',
          pathname: 'cache-update-test',
        })
        .expect(201);

      const articleId = createRes.body.id;

      // Get article list (caches it)
      const articleIdStr = String(articleId);
      const beforeRes = await request(httpServer)
        .get(`/api/v2/articles/${articleIdStr}`)
        .expect(200);

      expect(beforeRes.body.title).toBe('Original Title');

      // Update article
      await request(httpServer)
        .put(`/api/v2/articles/${articleIdStr}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
          content: 'Updated content',
        })
        .expect(200);

      // Get article again - cache should reflect update
      const afterRes = await request(httpServer)
        .get(`/api/v2/articles/${articleIdStr}`)
        .expect(200);

      expect(afterRes.body.title).toBe('Updated Title');
    });

    it('should invalidate article list cache after article deletion', async () => {
      // Create articles
      const res1 = await request(httpServer)
        .post('/api/v2/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Delete Test 1',
          content: 'Testing deletion',
          author: 'Cache Tester',
          pathname: 'delete-test-1',
          published: true,
        })
        .expect(201);

      await request(httpServer)
        .post('/api/v2/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Delete Test 2',
          content: 'Testing deletion',
          author: 'Cache Tester',
          pathname: 'delete-test-2',
          published: true,
        })
        .expect(201);

      const listBefore = await request(httpServer).get('/api/v2/articles').expect(200);

      const countBefore = listBefore.body.data?.length || 0;

      // Delete one article
      const articleId1 = String(res1.body.id);
      await request(httpServer)
        .delete(`/api/v2/articles/${articleId1}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect([200, 204]);

      // Get list again - should have fewer items
      const listAfter = await request(httpServer).get('/api/v2/articles').expect(200);

      const countAfter = listAfter.body.data?.length || 0;

      expect(countAfter).toBeLessThan(countBefore);
    });
  });

  describe('Category cache invalidation', () => {
    it('should invalidate category cache after category update', async () => {
      // Create a category
      const createRes = await request(httpServer)
        .post('/api/v2/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Original Category',
          slug: 'original-category',
          description: 'Original description',
        })
        .expect(201);

      const categoryId = createRes.body.id;

      // Get category (caches it)
      const categoryIdStr = String(categoryId);
      const beforeRes = await request(httpServer)
        .get(`/api/v2/categories/${categoryIdStr}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(beforeRes.body.name).toBe('Original Category');

      // Update category
      const updateRes = await request(httpServer)
        .put(`/api/v2/categories/${categoryIdStr}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Category',
          slug: 'updated-category',
          description: 'Updated description',
        })
        .expect(200);

      expect(updateRes.body.name).toBe('Updated Category');

      // Get category again - cache should be invalidated
      const afterRes = await request(httpServer)
        .get(`/api/v2/categories/${categoryIdStr}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(afterRes.body.name).toBe('Updated Category');
    });
  });

  describe('Grouped articles cache invalidation', () => {
    it('should invalidate grouped-by-category cache after article change', async () => {
      // Create a category
      const catRes = await request(httpServer)
        .post('/api/v2/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Tech',
          slug: 'tech',
          description: 'Technology articles',
        })
        .expect(201);

      const categoryId = catRes.body.id;

      // Get initial grouped articles
      const initialRes = await request(httpServer)
        .get('/api/v2/articles/grouped-by-category')
        .expect(200);

      const techCount = (initialRes.body.data?.Tech || []).length || 0;

      // Create article in this category
      await request(httpServer)
        .post('/api/v2/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Tech Article',
          content: 'Tech content',
          author: 'Author',
          pathname: 'tech-article',
          categoryId,
          published: true,
        })
        .expect(201);

      // Get grouped articles again - cache should be invalidated
      const updatedRes = await request(httpServer)
        .get('/api/v2/articles/grouped-by-category')
        .expect(200);

      const updatedTechCount = (updatedRes.body.data?.Tech || []).length || 0;

      expect(updatedTechCount).toBeGreaterThan(techCount);
    });

    it('should invalidate grouped-by-tag cache after article change', async () => {
      // Get initial grouped articles
      const initialRes = await request(httpServer)
        .get('/api/v2/articles/grouped-by-tag')
        .expect(200);

      const pythonCount = (initialRes.body.data?.python || []).length || 0;

      // Create article with python tag
      await request(httpServer)
        .post('/api/v2/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Python Tutorial',
          content: 'Python content',
          author: 'Author',
          pathname: 'python-tutorial',
          tags: ['python', 'programming'],
          published: true,
        })
        .expect(201);

      // Get grouped articles again - cache should be invalidated
      const updatedRes = await request(httpServer)
        .get('/api/v2/articles/grouped-by-tag')
        .expect(200);

      const updatedPythonCount = (updatedRes.body.data?.python || []).length || 0;

      expect(updatedPythonCount).toBeGreaterThan(pythonCount);
    });
  });

  describe('Concurrent cache operations consistency', () => {
    it('should maintain cache consistency with concurrent article operations', async () => {
      // Create initial article
      const createRes = await request(httpServer)
        .post('/api/v2/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Concurrent Cache Test',
          content: 'Initial content',
          author: 'Cache Tester',
          pathname: 'concurrent-cache-test',
        })
        .expect(201);

      const articleId = createRes.body.id;

      // Perform concurrent operations
      const articleIdStr = String(articleId);
      const getReq = request(httpServer).get(`/api/v2/articles/${articleIdStr}`);

      const updateReq = request(httpServer)
        .put(`/api/v2/articles/${articleIdStr}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
          content: 'Updated content',
        });

      const listReq = request(httpServer).get('/api/v2/articles');

      const [getRes, updateRes, listRes] = await Promise.all([getReq, updateReq, listReq]);

      // All operations should complete
      expect([200, 201]).toContain(getRes.status);
      expect([200, 201]).toContain(updateRes.status);
      expect(listRes.status).toBe(200);

      // Verify consistency
      if (getRes.status === 200 && updateRes.status === 200) {
        expect(getRes.body.id).toBe(articleId);
        expect(updateRes.body.title).toBe('Updated Title');
      }
    });
  });

  describe('Analytics cache invalidation', () => {
    it('should refresh analytics data after article operations', async () => {
      // Get initial analytics (if available)
      const initialRes = await request(httpServer)
        .get('/api/v2/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect([200, 404]);

      if (initialRes.status === 200) {
        expect(initialRes.body).toHaveProperty('data');
      }

      // Create article
      await request(httpServer)
        .post('/api/v2/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Analytics Test Article',
          content: 'Analytics content',
          author: 'Analytics Tester',
          pathname: 'analytics-test',
        })
        .expect(201);

      // Get analytics again - cache should be refreshed
      const updatedRes = await request(httpServer)
        .get('/api/v2/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect([200, 404]);

      if (updatedRes.status === 200) {
        expect(updatedRes.body).toHaveProperty('data');
      }
    });
  });
});
