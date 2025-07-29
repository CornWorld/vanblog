import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

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
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty('status', 'ok');

        expect(res.body).toHaveProperty('timestamp');

        expect(res.body).toHaveProperty('uptime');

        expect(res.body).toHaveProperty('environment');

        expect(res.body).toHaveProperty('version', '2.0.0');

        expect(typeof res.body.uptime).toBe('number');

        expect(res.body.uptime).toBeGreaterThan(0);
      });
  });
});
