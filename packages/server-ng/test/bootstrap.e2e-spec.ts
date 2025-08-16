import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';

import { cleanupDatabase, createUser } from './test-utils';

import type { Server } from 'http';

// e2e test for GET /api/v2/public/bootstrap
// Verifies that endpoint responds 200 and payload has minimal required shape

describe('BootstrapController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    // Configure app like in main.ts
    const configService = app.get(ConfigService);
    const appConfig = configService.app;
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '2',
    });

    await app.init();

    await createUser(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('GET /api/v2/public/bootstrap should return 200 and expected structure', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/v2/public/bootstrap')
      .expect(200);

    // basic response wrapper
    const { body } = res;
    expect(body).toHaveProperty('statusCode', 200);
    expect(body).toHaveProperty('data');

    const data = body.data as Record<string, unknown>;

    // core fields
    expect(data).toHaveProperty('version');
    expect(typeof (data as any).version).toBe('string');

    expect(data).toHaveProperty('tags');
    expect(Array.isArray((data as any).tags)).toBe(true);

    expect(data).toHaveProperty('totalArticles');
    expect(typeof (data as any).totalArticles).toBe('number');

    expect(data).toHaveProperty('siteInfo');
    expect(data).toHaveProperty('navigation');
    expect(Array.isArray((data as any).navigation)).toBe(true);

    expect(data).toHaveProperty('friendLinks');
    expect(Array.isArray((data as any).friendLinks)).toBe(true);

    expect(data).toHaveProperty('socialLinks');
    expect(Array.isArray((data as any).socialLinks)).toBe(true);

    expect(data).toHaveProperty('rewards');
    expect(Array.isArray((data as any).rewards)).toBe(true);

    expect(data).toHaveProperty('categories');
    expect(Array.isArray((data as any).categories)).toBe(true);

    // walineConfig is optional
    if ('walineConfig' in data) {
      const wc = data['walineConfig'];
      expect(typeof wc).toBe('object');
    }
  });
});
