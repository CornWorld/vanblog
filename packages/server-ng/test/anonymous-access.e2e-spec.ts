import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';

import { cleanupDatabase, createUser } from './test-utils';

import type { Server } from 'http';

/**
 * e2e tests for anonymous visitor token issuance and access control
 */
describe('Anonymous visitor token (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  let anonymousToken: string;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Keep consistency with other e2e suites
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    const configService = app.get(ConfigService);
    const appConfig = configService.app;
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });

    await app.init();
    httpServer = app.getHttpServer() as Server;

    // Seed a baseline admin to keep parity with other suites
    await createUser(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('POST /api/v2/auth/anonymous should issue an anonymous access token', async () => {
    const res = await request(httpServer).post('/api/v2/auth/anonymous').expect(201);

    expect(typeof res.body?.access_token).toBe('string');
    expect(typeof res.body?.expiresAt).toBe('string');

    anonymousToken = res.body.access_token as string;
    expect(anonymousToken.length).toBeGreaterThan(10);
  });

  it('GET /api/v2/sitemap/status should be accessible with anonymous token (viewer role -> sitemap:read)', async () => {
    const res = await request(httpServer)
      .get('/api/v2/sitemap/status')
      .set('Authorization', `Bearer ${anonymousToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('enabled');
    expect(res.body).toHaveProperty('sitemapUrl');
  });

  it('GET /api/v2/sitemap/urls should be accessible with anonymous token (viewer role -> sitemap:read)', async () => {
    const res = await request(httpServer)
      .get('/api/v2/sitemap/urls')
      .set('Authorization', `Bearer ${anonymousToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('urls');
    const body = res.body as { urls?: unknown[] };
    if (body.urls) {
      expect(Array.isArray(body.urls)).toBe(true);
    }
  });

  it('POST /api/v2/sitemap/generate should be forbidden (403) with anonymous token (missing sitemap:generate)', async () => {
    await request(httpServer)
      .post('/api/v2/sitemap/generate')
      .set('Authorization', `Bearer ${anonymousToken}`)
      .expect(403);
  });
});
