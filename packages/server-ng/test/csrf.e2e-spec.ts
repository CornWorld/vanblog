import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { cleanupDatabase, createTestApp } from './test-utils';

import type { INestApplication } from '@nestjs/common';

describe('CSRF Protection (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ fullConfig: true });
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('should get CSRF token from endpoint', async () => {
    const response = await request(app.getHttpServer()).get('/api/v2/auth/csrf-token').expect(200);

    expect(response.body).toHaveProperty('csrfToken');
    expect(typeof response.body.csrfToken).toBe('string');
    expect(response.body.csrfToken.length).toBeGreaterThan(0);
  });
});
