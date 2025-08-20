import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';
import { DATABASE_CONNECTION } from '../src/database/database.module';
import { articles, categories, tags } from '../src/database/schema';

import { createUser, cleanupDatabase } from './test-utils';

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { Server } from 'http';

/**
 * e2e for GET /api/v2/public/options
 */
describe('OptionsController (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let db: LibSQLDatabase;

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

    // database connection
    db = app.get<LibSQLDatabase>(DATABASE_CONNECTION);

    // Create admin user
    await createUser(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.delete(articles).execute();
    await db.delete(categories).execute();
    await db.delete(tags).execute();

    // Seed test data
    await db.insert(categories).values([
      {
        name: 'Technology',
        slug: 'technology',
        description: 'Tech articles',
      },
      {
        name: 'Lifestyle',
        slug: 'lifestyle',
        description: 'Life articles',
      },
    ]);

    await db.insert(tags).values([
      { name: 'JavaScript', slug: 'javascript' },
      { name: 'TypeScript', slug: 'typescript' },
      { name: 'React', slug: 'react' },
    ]);

    await db.insert(articles).values([
      {
        title: 'Test Article 1',
        content: 'Content 1',
        author: 'tester',
        pathname: 'test-article-1',
        category: 'Technology',
        tags: JSON.stringify(['JavaScript', 'React']),
        hidden: false,
        private: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        title: 'Test Article 2',
        content: 'Content 2',
        author: 'tester',
        pathname: 'test-article-2',
        category: 'Lifestyle',
        tags: JSON.stringify(['TypeScript']),
        hidden: false,
        private: false,
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]);
  });

  it('GET /api/v2/public/options should return 200 with empty include', async () => {
    const res = await request(httpServer).get('/api/v2/public/options').expect(200);

    expect(res.body).toHaveProperty('statusCode', 200);
    expect(res.body).toHaveProperty('data');

    const data = res.body.data as Record<string, unknown>;
    // Empty include should return empty object
    expect(Object.keys(data)).toHaveLength(0);
  });

  it('GET /api/v2/public/options?include=articles should return articles', async () => {
    const res = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'articles' })
      .expect(200);

    expect(res.body).toHaveProperty('statusCode', 200);
    expect(res.body).toHaveProperty('data');

    const data = res.body.data as Record<string, unknown>;
    expect(data).toHaveProperty('articles');
    expect(data).not.toHaveProperty('categories');
    expect(data).not.toHaveProperty('tags');

    const articles = data.articles as any;
    expect(articles).toHaveProperty('items');
    expect(Array.isArray(articles.items)).toBe(true);
    expect(articles.items).toHaveLength(2);
  });

  it('GET /api/v2/public/options?include=categories,tags should return categories and tags', async () => {
    const res = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'categories,tags' })
      .expect(200);

    expect(res.body).toHaveProperty('statusCode', 200);
    const data = res.body.data as Record<string, unknown>;

    expect(data).toHaveProperty('categories');
    expect(data).toHaveProperty('tags');
    expect(data).not.toHaveProperty('articles');

    const categories = data.categories as any[];
    expect(Array.isArray(categories)).toBe(true);
    expect(categories).toHaveLength(2);
    expect(categories[0]).toHaveProperty('name');
    expect(categories[0]).toHaveProperty('slug');
    expect(categories[0]).toHaveProperty('description');

    const tags = data.tags as any[];
    expect(Array.isArray(tags)).toBe(true);
    expect(tags).toHaveLength(3);
    expect(tags[0]).toHaveProperty('name');
    expect(tags[0]).toHaveProperty('slug');
  });

  it('GET /api/v2/public/options?include=siteMeta should return site metadata', async () => {
    const res = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'siteMeta' })
      .expect(200);

    expect(res.body).toHaveProperty('statusCode', 200);
    const data = res.body.data as Record<string, unknown>;

    expect(data).toHaveProperty('siteMeta');
    const siteMeta = data.siteMeta as any;
    expect(siteMeta).toHaveProperty('title');
    expect(siteMeta).toHaveProperty('description');
    expect(siteMeta).toHaveProperty('author');
    expect(siteMeta).toHaveProperty('keywords');
  });

  it('GET /api/v2/public/options?include=navigation,friendLinks should return navigation and friend links', async () => {
    const res = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'navigation,friendLinks' })
      .expect(200);

    expect(res.body).toHaveProperty('statusCode', 200);
    const data = res.body.data as Record<string, unknown>;

    expect(data).toHaveProperty('navigation');
    expect(data).toHaveProperty('friendLinks');

    const navigation = data.navigation as any[];
    expect(Array.isArray(navigation)).toBe(true);

    const friendLinks = data.friendLinks as any[];
    expect(Array.isArray(friendLinks)).toBe(true);
  });

  it('Cache key should respect query params (different results for different include)', async () => {
    const res1 = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'articles' })
      .expect(200);

    const res2 = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'categories' })
      .expect(200);

    const data1 = res1.body.data as Record<string, unknown>;
    const data2 = res2.body.data as Record<string, unknown>;

    // Should have different fields
    expect(data1).toHaveProperty('articles');
    expect(data1).not.toHaveProperty('categories');
    expect(data2).toHaveProperty('categories');
    expect(data2).not.toHaveProperty('articles');
  });

  it('Should handle invalid include values gracefully', async () => {
    const res = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'invalid,articles,unknown' })
      .expect(200);

    expect(res.body).toHaveProperty('statusCode', 200);
    const data = res.body.data as Record<string, unknown>;

    // Should only include valid 'articles' field
    expect(data).toHaveProperty('articles');
    expect(data).not.toHaveProperty('invalid');
    expect(data).not.toHaveProperty('unknown');
  });

  it('Include order should be ignored (categories,tags == tags,categories)', async () => {
    const resA = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'categories,tags' })
      .expect(200);

    const resB = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'tags,categories' })
      .expect(200);

    expect(resA.body).toHaveProperty('statusCode', 200);
    expect(resB.body).toHaveProperty('statusCode', 200);

    // 两次结果的字段集合应当一致
    const aKeys = Object.keys(resA.body.data as Record<string, unknown>).sort();
    const bKeys = Object.keys(resB.body.data as Record<string, unknown>).sort();
    expect(aKeys).toEqual(bKeys);
  });

  it('Duplicate include values should be de-duplicated', async () => {
    const res = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'articles,articles,categories,categories' })
      .expect(200);

    expect(res.body).toHaveProperty('statusCode', 200);
    const data = res.body.data as Record<string, unknown>;

    // Should only include unique fields
    expect(data).toHaveProperty('articles');
    expect(data).toHaveProperty('categories');
  });

  it('GET /api/v2/public/options?include=tags should not crash with dirty JSON in articles.tags', async () => {
    // Seed additional dirty data: invalid JSON, empty string, and hidden
    await db.insert(articles).values([
      {
        title: 'Dirty JSON Article',
        content: 'Content',
        author: 'tester',
        pathname: 'dirty-json-opt',
        category: null,
        tags: '["JavaScript", invalid]', // invalid JSON on purpose
        hidden: false,
        private: false,
        createdAt: '2024-01-05T00:00:00.000Z',
        updatedAt: '2024-01-05T00:00:00.000Z',
      },
      {
        title: 'Empty Tags Article',
        content: 'Content',
        author: 'tester',
        pathname: 'empty-tags-opt',
        category: null,
        tags: '', // empty string should be treated as no tags
        hidden: false,
        private: false,
        createdAt: '2024-01-06T00:00:00.000Z',
        updatedAt: '2024-01-06T00:00:00.000Z',
      },
      {
        title: 'Hidden Article JS',
        content: 'Content',
        author: 'tester',
        pathname: 'hidden-js-opt',
        category: null,
        tags: JSON.stringify(['JavaScript']),
        hidden: true,
        private: false,
        createdAt: '2024-01-07T00:00:00.000Z',
        updatedAt: '2024-01-07T00:00:00.000Z',
      },
    ]);

    const res = await request(httpServer)
      .get('/api/v2/public/options')
      .query({ include: 'tags' })
      .expect(200);

    expect(res.body).toHaveProperty('statusCode', 200);
    expect(res.body).toHaveProperty('data');

    const data = res.body.data as Record<string, unknown>;
    // Should include tags field and be an array of tag summaries
    expect(data).toHaveProperty('tags');

    const tagList = data.tags as Array<{ name: string; slug: string }>;
    expect(Array.isArray(tagList)).toBe(true);
    // We seeded 3 tags in beforeEach; dirty/hidden rows should not break the response
    expect(tagList.length).toBe(3);

    const names = new Set(tagList.map((t) => t.name));
    expect(names.has('JavaScript')).toBe(true);
    expect(names.has('TypeScript')).toBe(true);
    expect(names.has('React')).toBe(true);
  });
});
