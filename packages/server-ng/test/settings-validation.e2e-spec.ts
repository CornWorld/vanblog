import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createUser, createAuthToken, cleanupDatabase, createTestApp } from './test-utils';

import type { Server } from 'http';

/**
 * e2e negative tests for Settings v2 validation
 */
describe('SettingsController Validation (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    httpServer = app.getHttpServer() as Server;

    // Create admin user and login to get token
    await createUser(app);
    token = await createAuthToken(app);
  });
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('PATCH /api/v2/admin/settings/site-info should return 400 on invalid payload', async () => {
    const invalidBody = {
      siteName: '', // required non-empty per schema
      siteDescription: 'desc',
      authorName: 'author',
      siteKeywords: 'a,b,c',
    };

    const res = await request(httpServer)
      .patch('/api/v2/admin/settings/site-info')
      .auth(token)
      .send(invalidBody)
      .expect(400);

    // ts-rest validation returns { message, issues } without statusCode wrapper
    expect(res.body).toHaveProperty('message');
  });

  it('PATCH /api/v2/admin/settings/navigation should return 400 on invalid items', async () => {
    const invalidBody = {
      items: [
        {
          name: '', // invalid - non-empty required
          url: '', // invalid - non-empty required
          icon: 'home',
          target: '_self',
          order: 1,
        },
      ],
    };

    const res = await request(httpServer)
      .patch('/api/v2/admin/settings/navigation')
      .auth(token)
      .send(invalidBody)
      .expect(400);

    // ts-rest validation returns { message, issues } without statusCode wrapper
    expect(res.body).toHaveProperty('message');
  });
});
