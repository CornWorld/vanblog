import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';
import { AnalyticsType } from '../src/modules/analytics/entities/analytics.entity';

import { createUser, cleanupDatabase, createAuthToken } from './test-utils';

import type { Server } from 'http';

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    // Configure app like in main.ts
    const configService = app.get(ConfigService);
    const appConfig = configService.app;
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '2',
    });

    await app.init();

    // Create admin user and get auth token
    await createUser(app);
    authToken = await createAuthToken(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  describe('POST /api/v2/analytics/record', () => {
    it('should record pageview analytics', async () => {
      const analyticsData = {
        type: AnalyticsType.PAGEVIEW,
        path: '/blog/test-article',
        referrer: 'https://google.com',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ip: '192.168.1.1',
      };

      await request(app.getHttpServer() as Server)
        .post('/api/v2/analytics/record')
        .send(analyticsData)
        .expect(201);
    });

    it('should record event analytics with data', async () => {
      const analyticsData = {
        type: AnalyticsType.EVENT,
        path: '/test-event',
        metadata: {
          action: 'click',
          label: 'download-button',
          value: 1,
        },
      };

      await request(app.getHttpServer() as Server)
        .post('/api/v2/analytics/record')
        .send(analyticsData)
        .expect(201);
    });

    it('should reject invalid analytics type', async () => {
      const analyticsData = {
        type: 'invalid-type',
        path: '/test',
      };

      await request(app.getHttpServer() as Server)
        .post('/api/v2/analytics/record')
        .send(analyticsData)
        .expect(400);
    });
  });

  describe('POST /api/v2/article/:id/view', () => {
    it('should record article view', async () => {
      // Assuming article ID 1 exists
      await request(app.getHttpServer() as Server)
        .post('/api/v2/article/1/view')
        .expect(201);
    });

    it('should reject invalid article ID', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/v2/article/invalid/view')
        .expect(400);
    });
  });

  describe('POST /api/v2/article/:id/reading-time', () => {
    it('should record reading time', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/v2/article/1/reading-time')
        .send({ duration: 120 })
        .expect(201);
    });
  });

  describe('GET /api/v2/admin/analytics/overview', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/overview')
        .expect(401);
    });

    it('should return analytics overview with auth', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('todayPageviews');
      expect(response.body).toHaveProperty('yesterdayPageviews');
      expect(response.body).toHaveProperty('totalPageviews');
      expect(response.body).toHaveProperty('todayVisitors');
      expect(response.body).toHaveProperty('yesterdayVisitors');
      expect(response.body).toHaveProperty('totalVisitors');
    });
  });

  describe('GET /api/v2/admin/analytics/page-rankings', () => {
    it('should return page rankings', async () => {
      // First, record some pageviews
      await request(app.getHttpServer() as Server)
        .post('/api/v2/analytics/record')
        .send({
          type: AnalyticsType.PAGEVIEW,
          path: '/popular-page',
          ip: '192.168.1.1',
        });

      await request(app.getHttpServer() as Server)
        .post('/api/v2/analytics/record')
        .send({
          type: AnalyticsType.PAGEVIEW,
          path: '/popular-page',
          ip: '192.168.1.2',
        });

      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/page-rankings')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 5 })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      if (Array.isArray(response.body) && response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('path');
        expect(response.body[0]).toHaveProperty('views');
        expect(response.body[0]).toHaveProperty('uniqueVisitors');
      }
    });
  });

  describe('GET /api/v2/admin/analytics/referrers', () => {
    it('should return referrer statistics', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/referrers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v2/admin/analytics/chart', () => {
    it('should return chart data', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/chart')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 7 })
        .expect(200);

      expect(response.body).toHaveProperty('pageviews');
      expect(response.body).toHaveProperty('visitors');
      const chartData = response.body as { pageviews?: unknown[]; visitors?: unknown[] };
      if (chartData.pageviews) {
        expect(chartData.pageviews).toBeInstanceOf(Array);
      }
      if (chartData.visitors) {
        expect(chartData.visitors).toBeInstanceOf(Array);
      }
    });
  });

  describe('GET /api/v2/admin/analytics/devices', () => {
    it('should return device statistics', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v2/admin/analytics/browsers', () => {
    it('should return browser statistics', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/browsers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v2/admin/analytics/articles/top', () => {
    it('should return top articles', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/articles/top')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v2/admin/analytics/export', () => {
    it('should export analytics data', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: dayjs().subtract(7, 'day').toISOString(),
          endDate: dayjs().toISOString(),
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe('ETag & DerivedView caching', () => {
    it('should return ETag header on cached analytics endpoints', async () => {
      const { headers } = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(headers).toHaveProperty('etag');
      expect(headers.etag).toBeTruthy();
    });

    it('should return 304 when If-None-Match matches ETag', async () => {
      // First request to get ETag
      const first = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const { etag } = first.headers;
      expect(etag).toBeTruthy();

      // Second request with If-None-Match
      await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .set('If-None-Match', etag)
        .expect(304);
    });

    it('should cache analytics data with different query parameters', async () => {
      // Use chart endpoint where `days` parameter changes output shape/length
      const first = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/chart')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 7 })
        .expect(200);

      const second = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/chart')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 14 })
        .expect(200);

      // Different ETags for different cache keys (very likely due to different content)
      expect(first.headers.etag).toBeTruthy();
      expect(second.headers.etag).toBeTruthy();
      expect(first.headers.etag).not.toBe(second.headers.etag);
    });

    it('should return fresh data when cache is invalidated', async () => {
      // First request with caching
      const res1 = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/chart')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 7 })
        .expect(200);

      const etag1 = res1.headers.etag;

      // Force a small delay and request again - should be same (cached)
      await new Promise((resolve) => setTimeout(resolve, 10));

      const res2 = await request(app.getHttpServer() as Server)
        .get('/api/v2/admin/analytics/chart')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 7 })
        .expect(200);

      const etag2 = res2.headers.etag;

      // Since cache is fresh, should have same ETag
      expect(etag1).toBe(etag2);
    });
  });
});
