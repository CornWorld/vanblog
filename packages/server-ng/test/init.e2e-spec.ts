import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { users } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';
import { DATABASE_CONNECTION } from '../src/database';

import { cleanupDatabase } from './test-utils';

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { Server } from 'http';

describe('InitController (e2e) - CMS Initialization Flow', () => {
  let app: INestApplication;
  const adminCreds = {
    username: 'initadmin_e2e',
    password: 'InitP@ssw0rd!',
    nickname: 'Init Admin E2E',
  } as const;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    // Mirror main.ts settings
    const configService = app.get(ConfigService);
    const appConfig = configService.app;
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });

    await app.init();
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('POST /api/v2/public/init initializes CMS and creates an admin user', async () => {
    const payload = {
      admin: {
        username: adminCreds.username,
        password: adminCreds.password,
        nickname: adminCreds.nickname,
      },
      siteInfo: {
        title: 'VanBlog E2E',
        description: 'E2E initialization test',
        author: 'VBot',
        keywords: ['blog', 'e2e', 'init'],
      },
    };

    const res = await request(app.getHttpServer() as Server)
      .post('/api/v2/public/init')
      .send(payload)
      .expect(200);

    const body = res.body as {
      statusCode: number;
      data: {
        initialized: boolean;
        admin: { id: number; username: string };
        siteInfo?: Record<string, unknown>;
      };
    };

    expect(body).toHaveProperty('statusCode', 200);
    expect(body).toHaveProperty('data');
    expect(body.data.initialized).toBe(true);
    expect(body.data.admin.username).toBe(adminCreds.username);
    if (body.data.siteInfo) {
      expect(typeof body.data.siteInfo).toBe('object');
    }
  });

  it('allows the created admin to login via /api/v2/auth/login', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/api/v2/auth/login')
      .send({ username: adminCreds.username, password: adminCreds.password })
      .expect(200);

    const loginBody = res.body as { token?: string; access_token?: string };
    const token = loginBody.token ?? loginBody.access_token;
    expect(typeof token).toBe('string');
    expect((token as string).length).toBeGreaterThan(10);
  });

  it('repeated initialization returns 409 Conflict', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/v2/public/init')
      .send({
        admin: { username: 'another_admin', password: 'AnotherP@ss1!' },
      })
      .expect(409);
  });

  it('DB asserts: admin user has type=admin and permissions ["role:admin"]', async () => {
    const db = app.get<LibSQLDatabase>(DATABASE_CONNECTION);
    const rows = await db.select().from(users).where(eq(users.username, adminCreds.username));
    expect(rows.length).toBe(1);
    const row = rows[0] as any;
    expect(row.type).toBe('admin');
    // permissions is stored as JSON string
    expect(row.permissions).toBe(JSON.stringify(['role:admin']));
  });
});
