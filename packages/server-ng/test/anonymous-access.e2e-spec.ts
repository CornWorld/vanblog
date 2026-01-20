import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { cleanupDatabase, createUser, createTestApp } from './test-utils';

import type { Server } from 'http';

/**
 * e2e tests for anonymous visitor token issuance and access control
 */
describe('Anonymous visitor token (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  let anonymousToken: string;

  beforeAll(async () => {
    app = await createTestApp();
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
      .auth(anonymousToken)
      .expect(200);

    expect(res.body).toHaveProperty('enabled');
    expect(res.body).toHaveProperty('sitemapUrl');
  });

  it('GET /api/v2/sitemap/urls should be accessible with anonymous token (viewer role -> sitemap:read)', async () => {
    const res = await request(httpServer)
      .get('/api/v2/sitemap/urls')
      .auth(anonymousToken)
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
      .auth(anonymousToken)
      .expect(403);
  });
});
