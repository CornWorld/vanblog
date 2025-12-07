import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';
import { DATABASE_CONNECTION } from '../src/database';
import { articles } from '@vanblog/shared/drizzle';

import { createUser, cleanupDatabase } from './test-utils';

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { Server } from 'http';

/**
 * e2e for GET /api/v2/public/timeline
 */
describe('TimelineController (e2e)', () => {
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

    // Create admin user (many admin APIs or utils depend on it)
    await createUser(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  beforeEach(async () => {
    // Clean up articles before each test
    await db.delete(articles).execute();

    // Seed articles across years and visibility states
    await db.insert(articles).values([
      {
        title: 'Visible 2024 A',
        content: 'content',
        author: 'tester',
        pathname: 'visible-2024-a',
        tags: JSON.stringify(['e2e', 'timeline']),
        hidden: false,
        private: false,
        createdAt: '2024-05-10T12:00:00.000Z',
        updatedAt: '2024-05-10T12:00:00.000Z',
      },
      {
        title: 'Hidden 2024 B',
        content: 'content',
        author: 'tester',
        pathname: 'hidden-2024-b',
        tags: JSON.stringify(['e2e', 'timeline']),
        hidden: true,
        private: false,
        createdAt: '2024-03-01T00:00:00.000Z',
        updatedAt: '2024-03-01T00:00:00.000Z',
      },
      {
        title: 'Visible 2023 C',
        content: 'content',
        author: 'tester',
        pathname: 'visible-2023-c',
        tags: JSON.stringify(['e2e', 'timeline']),
        hidden: false,
        private: false,
        createdAt: '2023-12-20T00:00:00.000Z',
        updatedAt: '2023-12-20T00:00:00.000Z',
      },
      {
        title: 'Private 2024 D',
        content: 'content',
        author: 'tester',
        pathname: 'private-2024-d',
        tags: JSON.stringify(['e2e', 'timeline']),
        hidden: false,
        private: true,
        createdAt: '2024-06-01T00:00:00.000Z',
        updatedAt: '2024-06-01T00:00:00.000Z',
      },
    ]);
  });

  it('GET /api/v2/public/timeline should group by year and exclude hidden/private by default', async () => {
    const res = await request(httpServer).get('/api/v2/public/timeline').expect(200);

    // ts-rest returns body directly without wrapper
    const data = res.body as Partial<Record<string, any[]>>;

    // year keys should exist
    expect(Object.keys(data)).toContain('2024');
    expect(Object.keys(data)).toContain('2023');

    // 2024: only the visible article (hidden=false, private=false)
    const y2024 = data['2024'];
    expect(Array.isArray(y2024)).toBe(true);
    const titles2024 = (y2024 ?? []).map((a) => a.title);
    expect(titles2024).toContain('Visible 2024 A');
    expect(titles2024).not.toContain('Hidden 2024 B');
    expect(titles2024).not.toContain('Private 2024 D');

    // 2023: visible one
    const y2023 = data['2023'];
    expect(Array.isArray(y2023)).toBe(true);
    const titles2023 = (y2023 ?? []).map((a) => a.title);
    expect(titles2023).toContain('Visible 2023 C');
  });

  it('GET /api/v2/public/timeline?includeHidden=true should include hidden but still exclude private', async () => {
    const res = await request(httpServer)
      .get('/api/v2/public/timeline')
      .query({ includeHidden: 'true' })
      .expect(200);

    // ts-rest returns body directly without wrapper
    const data = res.body as Partial<Record<string, any[]>>;

    const y2024 = data['2024'];
    const titles2024 = (y2024 ?? []).map((a) => a.title);
    expect(titles2024).toContain('Visible 2024 A');
    expect(titles2024).toContain('Hidden 2024 B');
    expect(titles2024).not.toContain('Private 2024 D');
  });

  it('Cache key should respect query params (different results for different includeHidden)', async () => {
    const res1 = await request(httpServer).get('/api/v2/public/timeline').expect(200);
    const res2 = await request(httpServer)
      .get('/api/v2/public/timeline')
      .query({ includeHidden: 'true' })
      .expect(200);

    // ts-rest returns body directly without wrapper
    const titles2024_1 = ((res1.body as Partial<Record<string, any[]>>)['2024'] ?? []).map(
      (a) => a.title,
    );
    const titles2024_2 = ((res2.body as Partial<Record<string, any[]>>)['2024'] ?? []).map(
      (a) => a.title,
    );

    // should differ due to hidden article present in res2
    expect(titles2024_1).not.toEqual(titles2024_2);
    expect(titles2024_2).toContain('Hidden 2024 B');
  });
});
