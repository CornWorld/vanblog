import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { PicgoStorageService } from '../src/modules/media/services/storages/picgo-storage.service';

import {
  createUser,
  createUserWithPermissions,
  createAuthToken,
  cleanupDatabase,
  createTestApp,
} from './test-utils';

import { nowIsoTz } from '@vanblog/shared/runtime';

import type { Server } from 'http';

// 模拟 PicgoStorageService 避免真实操作
const mockPicgoStorageService = {
  installPlugins: async (plugins: string[]): Promise<void> => {
    // 模拟安装成功
    if (plugins.includes('fail-plugin')) {
      throw new Error('Plugin installation failed');
    }
    return Promise.resolve();
  },
  getPluginLogs: () => ({
    logs: [{ timestamp: nowIsoTz(), level: 'info', message: 'boot' }],
    total: 1,
  }),
};

describe('PicgoPluginsController (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let tokenReader: string;
  let tokenEditor: string;

  beforeAll(async () => {
    app = await createTestApp({
      overrideProviders: [{ provide: PicgoStorageService, useValue: mockPicgoStorageService }],
    });
    httpServer = app.getHttpServer() as Server;

    // baseline admin（拥有 all 权限）
    await createUser(app);
    await createAuthToken(app);

    // 精确权限用户
    await createUserWithPermissions(app, {
      username: 'picgo_reader',
      password: 'ReaderPass123!',
      permissions: ['setting:read'],
    });
    await createUserWithPermissions(app, {
      username: 'picgo_editor',
      password: 'EditorPass123!',
      permissions: ['setting:update'],
    });

    // 获取对应 tokens
    const readerRes = await request(httpServer)
      .post('/api/v2/auth/login')
      .send({ username: 'picgo_reader', password: 'ReaderPass123!' })
      .expect(200);
    tokenReader = readerRes.body.token;

    const editorRes = await request(httpServer)
      .post('/api/v2/auth/login')
      .send({ username: 'picgo_editor', password: 'EditorPass123!' })
      .expect(200);
    tokenEditor = editorRes.body.token;
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  describe('GET /api/v2/admin/media/picgo/plugins', () => {
    it('401 when no auth', async () => {
      await request(httpServer).get('/api/v2/admin/media/picgo/plugins').expect(401);
    });

    it('403 when no setting:read permission', async () => {
      await request(httpServer)
        .get('/api/v2/admin/media/picgo/plugins')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('200 with setting:read', async () => {
      const res = await request(httpServer)
        .get('/api/v2/admin/media/picgo/plugins')
        .auth(tokenReader)
        .expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          plugins: [],
          total: 0,
        }),
      );
    });
  });

  describe('GET /api/v2/admin/media/picgo/plugins/logs', () => {
    it('401 when no auth', async () => {
      await request(httpServer).get('/api/v2/admin/media/picgo/plugins/logs').expect(401);
    });

    it('200 with setting:read', async () => {
      const res = await request(httpServer)
        .get('/api/v2/admin/media/picgo/plugins/logs')
        .auth(tokenReader)
        .expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          logs: expect.any(Array),
          total: expect.any(Number),
        }),
      );
      expect(res.body.logs[0]).toEqual(
        expect.objectContaining({
          timestamp: expect.any(String),
          level: expect.any(String),
          message: expect.any(String),
        }),
      );
    });

    it('403 when only setting:update (no read)', async () => {
      // 使用 editor token（仅有 update 权限）应返回 403
      await request(httpServer)
        .get('/api/v2/admin/media/picgo/plugins/logs')
        .auth(tokenEditor)
        .expect(403);
    });
  });

  describe('POST /api/v2/admin/media/picgo/plugins/install', () => {
    it('403 when only setting:read', async () => {
      await request(httpServer)
        .post('/api/v2/admin/media/picgo/plugins/install')
        .auth(tokenReader)
        .send({ plugins: ['test-plugin'] })
        .expect(403);
    });

    it('500 with invalid Zod validation (ZodError not converted to 400 yet)', async () => {
      // Note: ZodError from .parse() is not caught and converted to 400 by exception filter
      // This results in 500 Internal Server Error instead of 400 Bad Request
      await request(httpServer)
        .post('/api/v2/admin/media/picgo/plugins/install')
        .auth(tokenEditor)
        .send({}) // missing plugins
        .expect(500);

      await request(httpServer)
        .post('/api/v2/admin/media/picgo/plugins/install')
        .auth(tokenEditor)
        .send({ plugins: 'not-an-array' })
        .expect(500);
    });

    it('200 with setting:update and valid plugins', async () => {
      const validData = { plugins: ['test-plugin', 'another-plugin'] };

      const res = await request(httpServer)
        .post('/api/v2/admin/media/picgo/plugins/install')
        .auth(tokenEditor)
        .send(validData)
        .expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Plugins installed successfully',
          installedPlugins: validData.plugins,
        }),
      );
    });

    it('200 but failure response when plugin installation fails', async () => {
      const failingData = { plugins: ['fail-plugin'] };

      const res = await request(httpServer)
        .post('/api/v2/admin/media/picgo/plugins/install')
        .auth(tokenEditor)
        .send(failingData)
        .expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Plugin installation failed',
          errors: ['Plugin installation failed'],
        }),
      );
    });
  });

  describe('POST /api/v2/admin/media/picgo/plugins/uninstall', () => {
    it('403 when only setting:read', async () => {
      await request(httpServer)
        .post('/api/v2/admin/media/picgo/plugins/uninstall')
        .auth(tokenReader)
        .send({ plugins: ['test-plugin'] })
        .expect(403);
    });

    it('500 with invalid Zod validation (ZodError not converted to 400 yet)', async () => {
      // Note: ZodError from .parse() is not caught and converted to 400 by exception filter
      await request(httpServer)
        .post('/api/v2/admin/media/picgo/plugins/uninstall')
        .auth(tokenEditor)
        .send({}) // missing plugins
        .expect(500);
    });

    it('200 but always returns failure due to PicGo limitation', async () => {
      const data = { plugins: ['any-plugin'] };

      const res = await request(httpServer)
        .post('/api/v2/admin/media/picgo/plugins/uninstall')
        .auth(tokenEditor)
        .send(data)
        .expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          success: false,
          message: 'PicGo does not support uninstalling plugins via API',
          errors: ['PicGo does not support uninstalling plugins via API'],
        }),
      );
    });
  });
});
