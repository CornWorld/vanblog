import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { cleanupDatabase, createTestApp } from './test-utils';

import type { Server } from 'http';

/**
 * Login Log Ts-Rest e2e tests
 *
 * Note: These tests currently fail due to:
 * 1. Route conflict between AuthController (versioned) and LoginLogTsRestController
 * 2. Query parameter type coercion issues (cutoffMinutes: z.number() expects number but query params are strings)
 *
 * TODO: Fix route registration and query parameter coercion in ts-rest contract
 */
describe('LoginLog Ts-Rest (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('GET /api/v2/auth/logs should return 200 and array', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/v2/auth/logs')
      .query({ success: 'true' })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v2/auth/logs/failed-attempts/by-username returns count', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/v2/auth/logs/failed-attempts/by-username')
      .query({ username: 'nonexistent', cutoffMinutes: '5' })
      .expect(200);

    expect(typeof res.body.count).toBe('number');
  });

  it('GET /api/v2/auth/logs/failed-attempts/by-ip returns count', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/v2/auth/logs/failed-attempts/by-ip')
      .query({ ip: '127.0.0.1', cutoffMinutes: '5' })
      .expect(200);

    expect(typeof res.body.count).toBe('number');
  });
});
