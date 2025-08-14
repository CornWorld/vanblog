import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, beforeAll, afterAll, it } from 'vitest';

import { AppModule } from './../src/app.module';
import { cleanupDatabase } from './test-utils';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';

describe('AppController (e2e)', () => {
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

  it('/ (GET)', () => {
    return request(app.getHttpServer() as Server)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
