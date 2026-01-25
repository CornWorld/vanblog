import request from 'supertest';
import { describe, beforeAll, afterAll, it } from 'vitest';

import { cleanupDatabase, createTestApp } from './test-utils';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ fullConfig: false });
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer() as Server)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
