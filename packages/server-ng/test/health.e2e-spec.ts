import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';

import type { Server } from 'http';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/health (GET)', () => {
    const httpServer = app.getHttpServer() as Server;
    return request(httpServer)
      .get('/api/health')
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as {
          status: string;
          timestamp: string;
          uptime: number;
          environment: string;
          version: string;
        };

        expect(body).toHaveProperty('status', 'ok');
        expect(body).toHaveProperty('timestamp');
        expect(body).toHaveProperty('uptime');
        expect(body).toHaveProperty('environment');
        expect(body).toHaveProperty('version', '2.0.0');
        expect(typeof body.uptime).toBe('number');
        expect(body.uptime).toBeGreaterThan(0);
      });
  });
});
