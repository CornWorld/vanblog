import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';

import { cleanupDatabase, createAuthToken, createUser } from './test-utils';

import type { Server } from 'http';

/**
 * e2e for Public Analytics APIs
 * - GET /api/v2/analytics/public/overview
 * - GET /api/v2/analytics/public/article/:id
 * - GET /api/v2/analytics/public/page-rankings
 */
describe('PublicAnalyticsController (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let authToken: string;
  let createdArticle: { id: number; pathname: string; title: string };

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

    await createUser(app);
    authToken = await createAuthToken(app);

    // Create an article via admin API
    const createRes = await request(httpServer)
      .post('/api/v2/articles')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Public Analytics Test Article',
        content: 'Hello Public Analytics',
        author: 'Tester',
        pathname: 'public-analytics-test-article',
        tags: ['e2e', 'analytics'],
      })
      .expect(201);

    expect(createRes.body).toHaveProperty('id');
    expect(createRes.body).toHaveProperty('pathname', 'public-analytics-test-article');

    createdArticle = {
      id: createRes.body.id as number,
      pathname: createRes.body.pathname as string,
      title: createRes.body.title as string,
    };

    // Seed analytics data for page rankings (with query params that should be sanitized)
    const popularPathWithQuery = '/popular-page?a=1&user=42';
    const lessPopularPath = '/less-popular';

    for (let i = 0; i < 5; i++) {
      await request(httpServer)
        .post('/api/v2/analytics/record')
        .send({
          type: 'pageview',
          path: popularPathWithQuery,
          ip: `10.0.0.${String(i + 1)}`,
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
          data: { articleId: createdArticle.id, note: 'popular' },
        })
        .expect(201);
    }

    for (let i = 0; i < 2; i++) {
      await request(httpServer)
        .post('/api/v2/analytics/record')
        .send({
          type: 'pageview',
          path: lessPopularPath,
          ip: `10.0.1.${String(i + 1)}`,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          data: { articleId: createdArticle.id, note: 'less-popular' },
        })
        .expect(201);
    }

    // Seed article related analytics: one via article view API, plus two pageviews with duration
    await request(httpServer)
      .post(`/api/v2/article/${String(createdArticle.id)}/view`)
      .expect(201);

    await request(httpServer)
      .post('/api/v2/analytics/record')
      .send({
        type: 'pageview',
        path: `/article/${createdArticle.pathname}`,
        ip: '20.0.0.1',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        data: { articleId: createdArticle.id, duration: 60 },
      })
      .expect(201);

    await request(httpServer)
      .post('/api/v2/analytics/record')
      .send({
        type: 'pageview',
        path: `/article/${createdArticle.pathname}`,
        ip: '20.0.0.2',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        data: { articleId: createdArticle.id, duration: 120 },
      })
      .expect(201);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('GET /api/v2/analytics/public/overview should return overview with basic fields', async () => {
    const res = await request(httpServer).get('/api/v2/analytics/public/overview').expect(200);

    expect(res.body).toHaveProperty('todayPageviews');
    expect(res.body).toHaveProperty('yesterdayPageviews');
    expect(res.body).toHaveProperty('totalPageviews');
    expect(res.body).toHaveProperty('todayVisitors');
    expect(res.body).toHaveProperty('yesterdayVisitors');
    expect(res.body).toHaveProperty('totalVisitors');

    // Ensure values are numbers
    for (const key of [
      'todayPageviews',
      'yesterdayPageviews',
      'totalPageviews',
      'todayVisitors',
      'yesterdayVisitors',
      'totalVisitors',
    ]) {
      expect(typeof res.body[key]).toBe('number');
      expect(res.body[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it('GET /api/v2/analytics/public/article/:id should return sanitized stats for the article', async () => {
    const res = await request(httpServer)
      .get(`/api/v2/analytics/public/article/${String(createdArticle.id)}`)
      .expect(200);

    expect(res.body).toHaveProperty('articleId', createdArticle.id);
    expect(res.body).toHaveProperty('title');
    expect(typeof res.body.title).toBe('string');

    // At least 1 view recorded via the view API + 2 via record API
    expect(res.body).toHaveProperty('views');
    expect(typeof res.body.views).toBe('number');
    expect(res.body.views).toBeGreaterThanOrEqual(2); // conservative lower bound

    // Unique visitors should be >= 2 given different IPs
    expect(res.body).toHaveProperty('uniqueVisitors');
    expect(typeof res.body.uniqueVisitors).toBe('number');
    expect(res.body.uniqueVisitors).toBeGreaterThanOrEqual(2);

    // Average read time should be derived from the two pageviews with duration (60, 120)
    expect(res.body).toHaveProperty('avgReadTime');
    expect(typeof res.body.avgReadTime).toBe('number');
    expect(res.body.avgReadTime).toBeGreaterThanOrEqual(60);
    expect(res.body.avgReadTime).toBeLessThanOrEqual(120);
  });

  it('GET /api/v2/analytics/public/page-rankings should return sanitized paths and counts', async () => {
    const res = await request(httpServer).get('/api/v2/analytics/public/page-rankings').expect(200);

    expect(Array.isArray(res.body)).toBe(true);

    // All returned paths must be sanitized (no query string)
    for (const item of res.body as Array<{ path: string; views: number }>) {
      expect(typeof item.path).toBe('string');
      expect(item.path.includes('?')).toBe(false);
      expect(typeof item.views).toBe('number');
      expect(item.views).toBeGreaterThan(0);
    }

    // Ensure our popular page appears with sanitized path
    const found = (res.body as Array<{ path: string; views: number }>).find(
      (it) => it.path === '/popular-page',
    );
    expect(found).toBeTruthy();
    if (found) {
      expect(found.views).toBeGreaterThanOrEqual(5);
    }
  });
});
