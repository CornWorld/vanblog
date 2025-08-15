import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { AppModule } from '../src/app.module';

import { cleanupDatabase } from './test-utils';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';

describe('V1 API Deprecation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('should return 410 Gone for v1 public endpoints', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/public/getByOption')
      .expect(410);

    expect(response.body).toMatchObject({
      statusCode: 410,
      error: 'Gone',
      message: 'V1 API has been permanently removed',
      details: {
        deprecatedEndpoint: '/api/v1/public/getByOption',
        removalDate: '2024-01-20',
        documentation: '/api/docs',
      },
    });

    expect(response.body.details.migrationGuide).toContain(
      'Use separate endpoints: GET /api/v2/articles',
    );
  });

  it('should return 410 Gone for v1 auth endpoints', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/login')
      .send({ username: 'test', password: 'test' })
      .expect(410);

    expect(response.body).toMatchObject({
      statusCode: 410,
      error: 'Gone',
      message: 'V1 API has been permanently removed',
      details: {
        deprecatedEndpoint: '/api/v1/auth/login',
        removalDate: '2024-01-20',
        documentation: '/api/docs',
      },
    });

    expect(response.body.details.migrationGuide).toContain('Use: POST /api/v2/auth/login');
  });

  it('should provide specific migration guidance for searchArticle', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/public/searchArticle?keyword=test')
      .expect(410);

    expect(response.body.details.migrationGuide).toContain(
      'Use: GET /api/v2/articles/search?keyword={keyword}',
    );
  });

  it('should provide specific migration guidance for timeline', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/public/getTimeLineInfo')
      .expect(410);

    expect(response.body.details.migrationGuide).toContain(
      'Timeline functionality is not yet implemented in V2',
    );
  });

  it('should allow v2 endpoints to work normally', async () => {
    await request(app.getHttpServer() as Server)
      .get('/health')
      .expect(200);
  });

  it('should allow non-api paths to work normally', async () => {
    await request(app.getHttpServer() as Server)
      .get('/')
      .expect(200);
  });
});
