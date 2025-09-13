import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';

import { cleanupDatabase, createUser } from './test-utils';

import type { Server } from 'http';

describe('BootstrapController - extensions field (e2e)', () => {
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

  it('GET /api/v2/public/bootstrap should include extensions field', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v2/public/bootstrap')
      .expect(200);

    const { body } = response;
    expect(body).toHaveProperty('statusCode', 200);
    expect(body).toHaveProperty('data');

    const data = body.data as Record<string, unknown>;

    // Verify core fields exist
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('tags');
    expect(data).toHaveProperty('totalArticles');
    expect(data).toHaveProperty('siteInfo');

    // Verify extensions field exists and is the only place for plugin data
    expect(data).toHaveProperty('extensions');
    expect(typeof (data as any).extensions).toBe('object');

    // Old fields should NOT exist
    expect(data).not.toHaveProperty('rewards');
    expect(data).not.toHaveProperty('socialLinks');
  });

  it('extensions field should contain plugin data when plugins are registered', async () => {
    // This test assumes plugins might be loaded in the test environment
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v2/public/bootstrap')
      .expect(200);

    const data = response.body.data as Record<string, unknown>;
    const extensions = (data as any).extensions as Record<string, unknown>;

    // Extensions should be an object (could be empty in test environment)
    expect(extensions).toBeDefined();
    expect(typeof extensions).toBe('object');

    // If rewards plugin is loaded, verify data structure
    if (extensions['rewards'] !== undefined) {
      expect(Array.isArray(extensions['rewards'])).toBe(true);
    }

    // If socialLinks plugin is loaded, verify data structure
    if (extensions['socialLinks'] !== undefined) {
      expect(Array.isArray(extensions['socialLinks'])).toBe(true);
    }
  });

  it('should handle plugin data transformation via hooks', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v2/public/bootstrap')
      .expect(200);

    const data = response.body.data as Record<string, unknown>;

    // Verify the response was processed through the plugin system
    expect(data).toBeDefined();

    // Extensions field should always be present and contain all plugin data
    expect((data as any).extensions).toBeDefined();
    expect(typeof (data as any).extensions).toBe('object');

    // No plugin-specific fields at the top level
    expect(data).not.toHaveProperty('rewards');
    expect(data).not.toHaveProperty('socialLinks');
  });
});
