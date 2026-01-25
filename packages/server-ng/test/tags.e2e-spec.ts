import { type INestApplication } from '@nestjs/common';
import { articles, tags } from '@vanblog/shared/drizzle';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { DATABASE_CONNECTION } from '../src/database';

import { createUser, cleanupDatabase, createTestApp } from './test-utils';

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { Server } from 'http';

/**
 * e2e for GET /api/v2/tags
 *
 * 目标：验证 QueryOptimizerService.batchCountArticlesByTags 在遇到脏 JSON (invalid JSON) 时不会报错，且统计结果正确。
 */
describe('TagController (e2e) - dirty JSON regression', () => {
  let app: INestApplication;
  let httpServer: Server;
  let db: LibSQLDatabase;

  beforeAll(async () => {
    app = await createTestApp();
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
    await db.delete(tags).execute();

    // Seed tags
    await db.insert(tags).values([
      { name: 'JavaScript', slug: 'javascript' },
      { name: 'TypeScript', slug: 'typescript' },
    ]);

    // Seed articles, mix valid JSON, invalid JSON, and hidden article
    await db.insert(articles).values([
      {
        title: 'Valid JS Article',
        content: 'Content',
        author: 'tester',
        pathname: 'valid-js',
        category: null,
        tags: ['JavaScript'],
        hidden: false,
        private: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        title: 'Hidden JS Article',
        content: 'Content',
        author: 'tester',
        pathname: 'hidden-js',
        category: null,
        tags: ['JavaScript'],
        hidden: true,
        private: false,
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-03T00:00:00.000Z',
      },
      {
        title: 'TS Article',
        content: 'Content',
        author: 'tester',
        pathname: 'ts-article',
        category: null,
        tags: ['TypeScript'],
        hidden: false,
        private: false,
        createdAt: '2024-01-04T00:00:00.000Z',
        updatedAt: '2024-01-04T00:00:00.000Z',
      },
    ]);

    // Insert dirty JSON article using raw SQL (invalid JSON in tags field)
    await db.run(
      sql`INSERT INTO articles (title, content, author, pathname, category, tags, hidden, private, created_at, updated_at)
          VALUES ('Dirty JSON Article', 'Content', 'tester', 'dirty-json', NULL, '["JavaScript"invalid', 0, 0, '2024-01-02T00:00:00.000Z', '2024-01-02T00:00:00.000Z')`,
    );
  });

  it('GET /api/v2/tags should not fail with invalid JSON in articles.tags and counts should ignore invalid/hidden rows', async () => {
    const res = await request(httpServer).get('/api/v2/tags').expect(200);

    const data = res.body as {
      items: Array<{ name: string; articleCount: number }>;
      total: number;
    };
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBe(2);

    const js = data.items.find((t) => t.name === 'JavaScript');
    const ts = data.items.find((t) => t.name === 'TypeScript');

    expect(js).toBeTruthy();
    expect(ts).toBeTruthy();

    if (!js || !ts) {
      throw new Error('Expected tags JavaScript and TypeScript in response');
    }

    // 只统计有效 JSON 且未隐藏的文章：
    // - Valid JS Article => +1
    // - Dirty JSON Article => 无效，应被忽略
    // - Hidden JS Article => 隐藏，应被忽略
    expect(js.articleCount).toBe(1);
    expect(ts.articleCount).toBe(1);
  });
});
