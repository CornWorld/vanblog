import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { cleanupDatabase, createAuthToken, createUser, createTestApp } from './test-utils';

import type { Server } from 'http';

/**
 * e2e for GET /api/v2/articles/by-path/:pathname
 */
describe('ArticleController - by-path (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    httpServer = app.getHttpServer() as Server;

    await createUser(app);
    authToken = await createAuthToken(app);

    // Create an article via admin API to ensure persistence path
    const createRes = await request(httpServer)
      .post('/api/v2/articles')
      .auth(authToken)
      .send({
        title: 'ByPath Test Article',
        content: 'Hello World',
        author: 'Tester',
        pathname: 'by-path-test-article',
        tags: ['e2e'],
      })
      .expect(201);

    expect(createRes.body).toHaveProperty('id');
    expect(createRes.body).toHaveProperty('pathname', 'by-path-test-article');
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('GET /api/v2/articles/by-path/:pathname should return the article', async () => {
    const res = await request(httpServer)
      .get('/api/v2/articles/by-path/by-path-test-article')
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('title', 'ByPath Test Article');
    expect(res.body).toHaveProperty('pathname', 'by-path-test-article');
  });

  it('GET /api/v2/articles/by-path/:pathname should 404 for non-existing', async () => {
    await request(httpServer).get('/api/v2/articles/by-path/not-exist-slug').expect(404);
  });
});
