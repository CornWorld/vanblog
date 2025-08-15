import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { DATABASE_CONNECTION } from '../src/database/database.module';
import { articles, categories, tags } from '../src/database/schema';

import { cleanupDatabase } from './test-utils';

import type { Database } from '../src/database/connection';
import type { Server } from 'http';

describe('PublicV1Controller (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let db: Database;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.forRoot()],
    }).compile();

    app = moduleFixture.createNestApplication();
    db = app.get<Database>(DATABASE_CONNECTION);

    // Configure app with same settings as main.ts
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'v',
    });
    app.setGlobalPrefix('api', {
      exclude: ['/health'],
    });

    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await cleanupDatabase(app);
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  async function seedTestData(): Promise<void> {
    // Seed categories
    await db.insert(categories).values({
      name: 'Technology',
      slug: 'technology',
      description: 'Tech articles',
      private: false,
      password: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await db.insert(categories).values({
      name: 'Travel',
      slug: 'travel',
      description: 'Travel experiences',
      private: false,
      password: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Seed tags
    await db.insert(tags).values({
      name: 'JavaScript',
      slug: 'javascript',
      createdAt: new Date().toISOString(),
    });
    await db.insert(tags).values({
      name: 'Node.js',
      slug: 'nodejs',
      createdAt: new Date().toISOString(),
    });
    await db.insert(tags).values({
      name: 'Adventure',
      slug: 'adventure',
      createdAt: new Date().toISOString(),
    });

    // Seed articles (hidden: false for public access)
    await db.insert(articles).values({
      title: 'Introduction to JavaScript',
      content: 'JavaScript is a versatile programming language...',
      pathname: 'intro-javascript',
      tags: JSON.stringify(['JavaScript', 'Node.js']),
      category: 'Technology',
      author: 'Admin',
      top: 0,
      hidden: false, // Public article
      private: false,
      password: null,
      viewer: 100,
      createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    });
    await db.insert(articles).values({
      title: 'Advanced Node.js Patterns',
      content: 'Exploring advanced patterns in Node.js development...',
      pathname: 'advanced-nodejs',
      tags: JSON.stringify(['Node.js']),
      category: 'Technology',
      author: 'Admin',
      top: 1,
      hidden: false, // Public article
      private: false,
      password: null,
      viewer: 250,
      createdAt: new Date('2024-01-15T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-01-15T00:00:00.000Z').toISOString(),
    });
    await db.insert(articles).values({
      title: 'My Trip to Japan',
      content: 'An amazing adventure through Japan...',
      pathname: 'japan-trip',
      tags: JSON.stringify(['Adventure']),
      category: 'Travel',
      author: 'Admin',
      top: 0,
      hidden: false, // Public article
      private: false,
      password: null,
      viewer: 75,
      createdAt: new Date('2024-02-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-02-01T00:00:00.000Z').toISOString(),
    });
    await db.insert(articles).values({
      title: 'Hidden Draft Article',
      content: 'This article is hidden from public view...',
      pathname: 'hidden-draft',
      tags: JSON.stringify(['JavaScript']),
      category: 'Technology',
      author: 'Admin',
      top: 0,
      hidden: true, // Hidden article - should not appear in public results
      private: false,
      password: null,
      viewer: 0,
      createdAt: new Date('2024-02-15T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-02-15T00:00:00.000Z').toISOString(),
    });
  }

  describe('GET /api/v1/public/getByOption', () => {
    it('should return articles when option=articles', async () => {
      const response = await request(server)
        .get('/api/v1/public/getByOption?option=articles')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data.articles).toHaveLength(3); // Only non-hidden articles
      expect(response.body.data).toHaveProperty('total', 3);
      expect(response.body.data).toHaveProperty('page', 1);
      expect(response.body.data).toHaveProperty('pageSize', 10);
      expect(response.body.data).toHaveProperty('totalPages', 1);

      // Verify articles are sorted by createdAt desc
      const { articles } = response.body.data;
      expect(articles[0].title).toBe('My Trip to Japan'); // Most recent
      expect(articles[1].title).toBe('Advanced Node.js Patterns');
      expect(articles[2].title).toBe('Introduction to JavaScript'); // Oldest
    });

    it('should return categories when option=categories', async () => {
      const response = await request(server)
        .get('/api/v1/public/getByOption?option=categories')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data).toHaveProperty('total', 2);

      // Verify category data and article counts
      const techCategory = response.body.data.items.find((cat: any) => cat.name === 'Technology');
      expect(techCategory).toBeDefined();
      expect(techCategory.articleCount).toBe(2); // 2 non-hidden tech articles

      const travelCategory = response.body.data.items.find((cat: any) => cat.name === 'Travel');
      expect(travelCategory).toBeDefined();
      expect(travelCategory.articleCount).toBe(1); // 1 travel article
    });

    it('should return tags when option=tags', async () => {
      const response = await request(server)
        .get('/api/v1/public/getByOption?option=tags')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.items).toHaveLength(3);
      expect(response.body.data).toHaveProperty('total', 3);

      // Verify tag article counts
      const jsTag = response.body.data.items.find((tag: any) => tag.name === 'JavaScript');
      expect(jsTag).toBeDefined();
      expect(jsTag.articleCount).toBe(1); // Only 1 visible JS article (hidden one excluded)

      const nodeTag = response.body.data.items.find((tag: any) => tag.name === 'Node.js');
      expect(nodeTag).toBeDefined();
      expect(nodeTag.articleCount).toBe(2); // Both JS intro and advanced Node.js

      const adventureTag = response.body.data.items.find((tag: any) => tag.name === 'Adventure');
      expect(adventureTag).toBeDefined();
      expect(adventureTag.articleCount).toBe(1); // Japan trip article
    });

    it('should handle pagination for articles', async () => {
      const response = await request(server)
        .get('/api/v1/public/getByOption?option=articles&page=1&pageSize=2')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data.articles).toHaveLength(2); // Limited by pageSize
      expect(response.body.data).toHaveProperty('total', 3);
      expect(response.body.data).toHaveProperty('page', 1);
      expect(response.body.data).toHaveProperty('pageSize', 2);
      expect(response.body.data).toHaveProperty('totalPages', 2);
    });

    it('should return 400 for invalid option', async () => {
      await request(server).get('/api/v1/public/getByOption?option=invalid').expect(400);
    });
  });

  describe('GET /api/v1/public/searchArticle', () => {
    it('should search articles by keyword', async () => {
      const response = await request(server)
        .get('/api/v1/public/searchArticle?keyword=JavaScript')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data.articles).toHaveLength(1); // Only non-hidden JS article
      expect(response.body.data.articles[0]).toHaveProperty('title', 'Introduction to JavaScript');
    });

    it('should return empty results for non-existent keyword', async () => {
      const response = await request(server)
        .get('/api/v1/public/searchArticle?keyword=NonExistentKeyword')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data.articles).toHaveLength(0);
      expect(response.body.data).toHaveProperty('total', 0);
    });

    it('should handle pagination in search', async () => {
      const response = await request(server)
        .get('/api/v1/public/searchArticle?keyword=Node&page=1&pageSize=1')
        .expect(200);

      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data.articles).toHaveLength(1);
      expect(response.body.data).toHaveProperty('pageSize', 1);
    });
  });

  describe('GET /api/v1/public/getArticleByIdOrPathname/:idOrPathname', () => {
    it('should get article by id', async () => {
      const response = await request(server)
        .get('/api/v1/public/getArticleByIdOrPathname/1')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('title', 'Introduction to JavaScript');
    });

    it('should get article by pathname', async () => {
      const response = await request(server)
        .get('/api/v1/public/getArticleByIdOrPathname/advanced-nodejs')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('title', 'Advanced Node.js Patterns');
    });

    it('should return 404 for non-existent id', async () => {
      await request(server).get('/api/v1/public/getArticleByIdOrPathname/999').expect(404);
    });

    it('should return 404 for non-existent pathname', async () => {
      await request(server)
        .get('/api/v1/public/getArticleByIdOrPathname/non-existent-pathname')
        .expect(404);
    });

    it('should return 404 for hidden article', async () => {
      await request(server).get('/api/v1/public/getArticleByIdOrPathname/hidden-draft').expect(404);
    });
  });

  describe('GET /api/v1/public/getArticlesByCategory/:categoryName', () => {
    it('should get articles by category name', async () => {
      const response = await request(server)
        .get('/api/v1/public/getArticlesByCategory/Technology')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data.articles).toHaveLength(2); // 2 non-hidden tech articles
      expect(response.body.data.articles.every((a: any) => a.category === 'Technology')).toBe(true);
    });

    it('should return empty for non-existent category', async () => {
      const response = await request(server)
        .get('/api/v1/public/getArticlesByCategory/NonExistent')
        .expect(200);

      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data.articles).toHaveLength(0);
    });

    it('should handle pagination', async () => {
      const response = await request(server)
        .get('/api/v1/public/getArticlesByCategory/Technology?page=1&pageSize=1')
        .expect(200);

      expect(response.body.data.articles).toHaveLength(1);
      expect(response.body.data).toHaveProperty('total', 2);
      expect(response.body.data).toHaveProperty('totalPages', 2);
    });
  });

  describe('GET /api/v1/public/getArticlesByTag/:tagId', () => {
    it('should get articles by tag id', async () => {
      const response = await request(server).get('/api/v1/public/getArticlesByTag/1').expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data.articles).toHaveLength(1); // Only 1 visible JS article
    });

    it('should return 404 for non-existent tag id', async () => {
      await request(server).get('/api/v1/public/getArticlesByTag/999').expect(404);
    });
  });

  describe('GET /api/v1/public/getArticlesByTagName/:tagName', () => {
    it('should get articles by tag name', async () => {
      const response = await request(server)
        .get('/api/v1/public/getArticlesByTagName/JavaScript')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data.articles).toHaveLength(1); // Only 1 visible JS article
    });

    it('should return empty for non-existent tag name', async () => {
      const response = await request(server)
        .get('/api/v1/public/getArticlesByTagName/NonExistentTag')
        .expect(200);

      expect(response.body.data).toHaveProperty('articles');
      expect(response.body.data.articles).toHaveLength(0);
    });
  });

  describe('GET /api/v1/public/getTimeLineInfo', () => {
    it('should get timeline information', async () => {
      const response = await request(server).get('/api/v1/public/getTimeLineInfo').expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('timeline');
      expect(Array.isArray(response.body.data.timeline)).toBe(true);
    });
  });

  describe('GET /api/v1/public/getMeta', () => {
    it('should get meta information', async () => {
      const response = await request(server).get('/api/v1/public/getMeta').expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /api/v1/public/getBuildMeta', () => {
    it('should get build meta information', async () => {
      const response = await request(server).get('/api/v1/public/getBuildMeta').expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('data');
    });
  });
});
