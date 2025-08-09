import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from './../src/app.module';

import type { INestApplication } from '@nestjs/common';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const appModule = await AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer() as unknown as string)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
