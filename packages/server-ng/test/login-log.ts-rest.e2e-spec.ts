import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { cleanupDatabase, createTestApp, createUser, createAuthToken } from './test-utils';

import type { Server } from 'http';

/**
 * Login Log Ts-Rest e2e tests
 *
 * These endpoints now require authentication due to security fixes.
 * All login log endpoints are protected with @Perm('auth', ['read']).
 */
describe('LoginLog Ts-Rest (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    // Create admin user and get auth token
    await createUser(app);
    token = await createAuthToken(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('GET /api/v2/auth/logs should return 200 and array', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/v2/auth/logs')
      .auth(token)
      .query({ success: 'true' })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v2/auth/logs/failed-attempts/by-username returns count', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/v2/auth/logs/failed-attempts/by-username')
      .auth(token)
      .query({ username: 'nonexistent', cutoffMinutes: '5' })
      .expect(200);

    expect(typeof res.body.count).toBe('number');
  });

  it('GET /api/v2/auth/logs/failed-attempts/by-ip returns count', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/v2/auth/logs/failed-attempts/by-ip')
      .auth(token)
      .query({ ip: '127.0.0.1', cutoffMinutes: '5' })
      .expect(200);

    expect(typeof res.body.count).toBe('number');
  });

  it('GET /api/v2/auth/logs should return 401 without authentication', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v2/auth/logs')
      .query({ success: 'true' })
      .expect(401);
  });

  it('GET /api/v2/auth/logs/failed-attempts/by-username should return 401 without authentication', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v2/auth/logs/failed-attempts/by-username')
      .query({ username: 'nonexistent', cutoffMinutes: '5' })
      .expect(401);
  });

  it('GET /api/v2/auth/logs/failed-attempts/by-ip should return 401 without authentication', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v2/auth/logs/failed-attempts/by-ip')
      .query({ ip: '127.0.0.1', cutoffMinutes: '5' })
      .expect(401);
  });
});
