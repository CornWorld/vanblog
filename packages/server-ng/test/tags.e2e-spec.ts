import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';
import { DATABASE_CONNECTION } from '../src/database';
import { articles, tags } from '../src/database/schema';

import { createUser, cleanupDatabase } from './test-utils';

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
        tags: JSON.stringify(['JavaScript']),
        hidden: false,
        private: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        title: 'Dirty JSON Article',
        content: 'Content',
        author: 'tester',
        pathname: 'dirty-json',
        category: null,
        // 故意写入非法 JSON，确保 SQL 使用 json_valid(...) 保护
        tags: '["JavaScript", invalid]',
        hidden: false,
        private: false,
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
      {
        title: 'Hidden JS Article',
        content: 'Content',
        author: 'tester',
        pathname: 'hidden-js',
        category: null,
        tags: JSON.stringify(['JavaScript']),
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
        tags: JSON.stringify(['TypeScript']),
        hidden: false,
        private: false,
        createdAt: '2024-01-04T00:00:00.000Z',
        updatedAt: '2024-01-04T00:00:00.000Z',
      },
    ]);
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
