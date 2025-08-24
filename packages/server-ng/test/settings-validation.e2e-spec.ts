import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';

import { createUser, createAuthToken, cleanupDatabase } from './test-utils';

import type { Server } from 'http';

/**
 * e2e negative tests for Settings v2 validation
 */
describe('SettingsController Validation (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let token: string;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    const configService = app.get(ConfigService);
    const appConfig = configService.app;
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });

    await app.init();
    httpServer = app.getHttpServer() as Server;

    // Create admin user and login to get token
    await createUser(app);
    token = await createAuthToken(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('PATCH /api/v2/api/admin/settings/site-info should return 400 on invalid payload', async () => {
    const invalidBody = {
      siteName: '', // required non-empty per schema
      siteDescription: 'desc',
      authorName: 'author',
      siteKeywords: 'a,b,c',
    };

    const res = await request(httpServer)
      .patch('/api/v2/api/admin/settings/site-info')
      .set('Authorization', `Bearer ${token}`)
      .send(invalidBody)
      .expect(400);

    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('message');
  });

  it('PATCH /api/v2/api/admin/settings/navigation should return 400 on invalid items', async () => {
    const invalidBody = {
      items: [
        {
          name: '', // invalid - non-empty required
          url: '', // invalid - non-empty required
          icon: 'home',
          target: '_self',
          order: 1,
        },
      ],
    };

    const res = await request(httpServer)
      .patch('/api/v2/api/admin/settings/navigation')
      .set('Authorization', `Bearer ${token}`)
      .send(invalidBody)
      .expect(400);

    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('message');
  });
});
