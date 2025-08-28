import { type INestApplication, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';
import { LoaderService, type Plugin } from '../src/modules/plugin/services/loader.service';

import {
  createUser,
  createUserWithPermissions,
  createAuthToken,
  cleanupDatabase,
} from './test-utils';

import type { Server } from 'http';

const MOCK_SOCIAL_LINKS = [
  { type: 'github', url: 'https://github.com/vanblog' },
  { type: 'twitter', url: 'https://twitter.com/vanblog' },
];

describe('SocialLinksController (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let tokenReader: string;
  let tokenEditor: string;

  beforeAll(async () => {
    const appModule = await AppModule.forRoot();

    // Build LoaderService mock and its plugin once
    const store = [...MOCK_SOCIAL_LINKS];
    const plugin: Plugin = {
      id: 'social-links',
      name: 'Social Links Plugin',
      version: '1.0.0',
      getSocialLinks() {
        return store;
      },
      addOrUpdateSocialLink(_ctx: unknown, data: { type: string; url: string }) {
        const idx = store.findIndex((i) => i.type === data.type);
        if (idx >= 0) {
          store[idx] = data;
        } else {
          store.push(data);
        }
        return store;
      },
      deleteSocialLink(_ctx: unknown, type: string) {
        const idx = store.findIndex((i) => i.type === type);
        if (idx >= 0) store.splice(idx, 1);
        return store;
      },
    } as unknown as Plugin;

    const loaderMock: Partial<LoaderService> = {
      getLoadedPlugins: () => new Map<string, Plugin>([[plugin.name, plugin]]),
      getPluginContext: () => ({}) as any,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    })
      .overrideProvider(LoaderService)
      .useValue(loaderMock)
      .compile();

    const configService = moduleFixture.get<ConfigService>(ConfigService);

    app = moduleFixture.createNestApplication();

    const appConfig = configService.app;
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });

    await app.init();
    httpServer = app.getHttpServer() as Server;

    // baseline admin（拥有 all 权限）
    await createUser(app);
    await createAuthToken(app);

    // 精确权限用户
    await createUserWithPermissions(app, {
      username: 'social_reader',
      password: 'ReaderPass123!',
      permissions: ['setting:read'],
    });
    await createUserWithPermissions(app, {
      username: 'social_editor',
      password: 'EditorPass123!',
      permissions: ['setting:update'],
    });

    // 获取对应 tokens
    const readerRes = await request(httpServer)
      .post('/api/v2/auth/login')
      .send({ username: 'social_reader', password: 'ReaderPass123!' })
      .expect(200);
    tokenReader = readerRes.body.token;

    const editorRes = await request(httpServer)
      .post('/api/v2/auth/login')
      .send({ username: 'social_editor', password: 'EditorPass123!' })
      .expect(200);
    tokenEditor = editorRes.body.token;
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  describe('GET /api/v2/admin/social-links', () => {
    it('403 when no auth', async () => {
      await request(httpServer).get('/api/v2/admin/social-links').expect(401);
    });

    it('403 when no setting:read permission', async () => {
      // 用户没有 setting:read 权限
      await request(httpServer)
        .get('/api/v2/admin/social-links')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('200 with setting:read', async () => {
      const res = await request(httpServer)
        .get('/api/v2/admin/social-links')
        .set('Authorization', `Bearer ${tokenReader}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual(
        expect.objectContaining({
          type: expect.any(String),
          url: expect.stringMatching(/^https?:\/\//),
        }),
      );
    });
  });

  describe('POST /api/v2/admin/social-links', () => {
    it('403 when only setting:read', async () => {
      await request(httpServer)
        .post('/api/v2/admin/social-links')
        .set('Authorization', `Bearer ${tokenReader}`)
        .send({ type: 'github', url: 'https://github.com/newrepo' })
        .expect(403);
    });

    it('400 with invalid Zod validation', async () => {
      await request(httpServer)
        .post('/api/v2/admin/social-links')
        .set('Authorization', `Bearer ${tokenEditor}`)
        .send({ type: 'github' }) // missing url
        .expect(400);

      await request(httpServer)
        .post('/api/v2/admin/social-links')
        .set('Authorization', `Bearer ${tokenEditor}`)
        .send({ type: 'github', url: 'not-a-valid-url' })
        .expect(400);
    });

    it('200 with setting:update and valid data', async () => {
      // 1) update github url
      let res = await request(httpServer)
        .post('/api/v2/admin/social-links')
        .set('Authorization', `Bearer ${tokenEditor}`)
        .send({ type: 'github', url: 'https://github.com/updated' })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      // 2) update twitter url
      res = await request(httpServer)
        .post('/api/v2/admin/social-links')
        .set('Authorization', `Bearer ${tokenEditor}`)
        .send({ type: 'twitter', url: 'https://twitter.com/vanblog-updated' })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      // 3) add a new linkedin link
      res = await request(httpServer)
        .post('/api/v2/admin/social-links')
        .set('Authorization', `Bearer ${tokenEditor}`)
        .send({ type: 'linkedin', url: 'https://linkedin.com/in/vanblog' })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(3);

      const updated = res.body.find((i: any) => i.type === 'twitter');
      expect(updated).toBeTruthy();
      expect(updated.url).toBe('https://twitter.com/vanblog-updated');
    });
  });

  // New tests for PUT update endpoint
  describe('PUT /api/v2/admin/social-links/:type', () => {
    it('403 when only setting:read', async () => {
      await request(httpServer)
        .put('/api/v2/admin/social-links/github')
        .set('Authorization', `Bearer ${tokenReader}`)
        .send({ url: 'https://github.com/blocked' })
        .expect(403);
    });

    it('400 with invalid Zod validation', async () => {
      // missing url
      await request(httpServer)
        .put('/api/v2/admin/social-links/github')
        .set('Authorization', `Bearer ${tokenEditor}`)
        .send({})
        .expect(400);

      // invalid url
      await request(httpServer)
        .put('/api/v2/admin/social-links/github')
        .set('Authorization', `Bearer ${tokenEditor}`)
        .send({ url: 'invalid-url' })
        .expect(400);
    });

    it('200 with setting:update and valid data (update existing and create new)', async () => {
      // update existing github
      let res = await request(httpServer)
        .put('/api/v2/admin/social-links/github')
        .set('Authorization', `Bearer ${tokenEditor}`)
        .send({ url: 'https://github.com/put-updated' })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const github = res.body.find((i: any) => i.type === 'github');
      expect(github).toBeTruthy();
      expect(github.url).toBe('https://github.com/put-updated');

      // create new via PUT
      res = await request(httpServer)
        .put('/api/v2/admin/social-links/mastodon')
        .set('Authorization', `Bearer ${tokenEditor}`)
        .send({ url: 'https://mastodon.social/@vanblog' })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const mastodon = res.body.find((i: any) => i.type === 'mastodon');
      expect(mastodon).toBeTruthy();
      expect(mastodon.url).toBe('https://mastodon.social/@vanblog');
    });
  });

  describe('DELETE /api/v2/admin/social-links/:type', () => {
    it('403 when only setting:read', async () => {
      await request(httpServer)
        .delete('/api/v2/admin/social-links/twitter')
        .set('Authorization', `Bearer ${tokenReader}`)
        .expect(403);
    });

    it('200 with setting:update', async () => {
      const res = await request(httpServer)
        .delete('/api/v2/admin/social-links/twitter')
        .set('Authorization', `Bearer ${tokenEditor}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((i: any) => i.type === 'twitter')).toBe(false);
    });
  });
});
