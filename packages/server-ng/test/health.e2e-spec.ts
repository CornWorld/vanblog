import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { cleanupDatabase, createTestApp } from './test-utils';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
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
