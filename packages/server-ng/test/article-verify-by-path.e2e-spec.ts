import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { cleanupDatabase, createAuthToken, createUser, createTestApp } from './test-utils';

import type { Server } from 'http';

/**
 * e2e for POST /api/v2/articles/by-path/:pathname/verify-password and GET /api/v2/articles/by-path/:pathname
 */
describe('ArticleController - verify by pathname (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    httpServer = app.getHttpServer() as Server;

    await createUser(app);
    authToken = await createAuthToken(app);

    // Create a private article with pathname and password via admin API
    const createRes = await request(httpServer)
      .post('/api/v2/articles')
      .auth(authToken)
      .send({
        title: 'Private Path Article',
        content: 'Secret Content',
        author: 'Tester',
        pathname: 'private-path-article',
        password: 's3cr3t',
        private: true,
      })
      .expect(201);

    expect(createRes.body).toHaveProperty('id');
    expect(createRes.body).toHaveProperty('pathname', 'private-path-article');
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('should deny access to private article by pathname without token', async () => {
    await request(httpServer).get('/api/v2/articles/by-path/private-path-article').expect(401);
  });

  it('should verify password by pathname and then access article with token', async () => {
    const verifyRes = await request(httpServer)
      .post('/api/v2/articles/by-path/private-path-article/verify-password')
      .send({ password: 's3cr3t' })
      .expect(200);

    expect(verifyRes.body).toHaveProperty('success', true);
    expect(verifyRes.body).toHaveProperty('token');
    const token = verifyRes.body.token as string;

    const getRes = await request(httpServer)
      .get('/api/v2/articles/by-path/private-path-article')
      .auth(token)
      .expect(200);

    expect(getRes.body).toHaveProperty('title', 'Private Path Article');
    expect(getRes.body).toHaveProperty('pathname', 'private-path-article');
    expect(getRes.body).toHaveProperty('private', true);
  });
});
