import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  createUser,
  createUserWithPermissions,
  createAuthToken,
  cleanupDatabase,
  createTestApp,
} from './test-utils';

import type { Server } from 'http';

/**
 * e2e tests for permission guard behavior on SitemapController
 */
describe('SitemapController - permissions (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  let readerToken: string; // has sitemap:read
  let generatorToken: string; // has sitemap:generate + sitemap:read

  beforeAll(async () => {
    app = await createTestApp();
    httpServer = app.getHttpServer() as Server;

    // Seed an admin for potential future use (keeps parity with other suites)
    await createUser(app);

    // Create users with specific permissions for this suite
    await createUserWithPermissions(app, {
      username: 'sitemap_reader',
      password: 'ReaderPass123!',
      permissions: ['sitemap:read'],
    });
    await createUserWithPermissions(app, {
      username: 'sitemap_generator',
      password: 'GeneratorPass123!',
      permissions: ['sitemap:generate', 'sitemap:read'],
    });

    readerToken = await createAuthToken(app, {
      username: 'sitemap_reader',
      password: 'ReaderPass123!',
    });

    generatorToken = await createAuthToken(app, {
      username: 'sitemap_generator',
      password: 'GeneratorPass123!',
    });
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  describe('POST /api/v2/sitemap/generate', () => {
    it('should return 401 without auth', async () => {
      await request(httpServer).post('/api/v2/sitemap/generate').expect(401);
    });

    it('should return 403 with sitemap:read only (missing sitemap:generate)', async () => {
      await request(httpServer).post('/api/v2/sitemap/generate').auth(readerToken).expect(403);
    });

    it('should allow with sitemap:generate', async () => {
      // Explicitly expect 200 OK since controller uses @HttpCode(200)
      await request(httpServer).post('/api/v2/sitemap/generate').auth(generatorToken).expect(200);
    });
  });

  describe('GET /api/v2/sitemap/status', () => {
    it('should require auth', async () => {
      await request(httpServer).get('/api/v2/sitemap/status').expect(401);
    });

    it('should allow with sitemap:read', async () => {
      const res = await request(httpServer)
        .get('/api/v2/sitemap/status')
        .auth(readerToken)
        .expect(200);

      expect(res.body).toHaveProperty('enabled');
      expect(res.body).toHaveProperty('sitemapUrl');
    });
  });

  describe('GET /api/v2/sitemap/urls', () => {
    it('should require auth', async () => {
      await request(httpServer).get('/api/v2/sitemap/urls').expect(401);
    });

    it('should allow with sitemap:read', async () => {
      const res = await request(httpServer)
        .get('/api/v2/sitemap/urls')
        .auth(readerToken)
        .expect(200);

      expect(res.body).toHaveProperty('urls');
      const body = res.body as { urls?: unknown[] };
      if (body.urls) {
        expect(Array.isArray(body.urls)).toBe(true);
      }
    });
  });
});
