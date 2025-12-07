import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { AppModule } from '../src/app.module';

import { cleanupDatabase } from './test-utils';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('/api/health (GET)', () => {
    const httpServer = app.getHttpServer() as Server;
    return request(httpServer)
      .get('/api/health')
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as {
          timestamp: string;
        };

        expect(body).toHaveProperty('timestamp');
        expect(typeof body.timestamp).toBe('string');
      });
  });
});
