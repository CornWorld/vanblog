import { Controller, Get, Module, INestApplication, VersioningType } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';
import { Permission, Perm } from '../src/modules/auth/permissions.decorator';
import { PermissionModule } from '../src/modules/permission/permission.module';

import {
  createUser,
  createUserWithPermissions,
  createAuthToken,
  cleanupDatabase,
} from './test-utils';

import type { Server } from 'http';

@ApiTags('perm-test')
@Controller({ path: 'perm-test', version: '2' })
class PermTestController {
  // 使用模块+权限数组格式
  @Get('a')
  @Permission('permtest', ['read'])
  a(): { ok: true } {
    return { ok: true } as const;
  }

  // 使用多权限格式，要求同时具备 read 与 write
  @Get('b')
  @Permission('permtest:read', 'permtest:write')
  b(): { ok: true } {
    return { ok: true } as const;
  }

  // 使用别名 Perm
  @Get('c')
  @Perm('permtest', ['write'])
  c(): { ok: true } {
    return { ok: true } as const;
  }
}

@Module({
  imports: [PermissionModule.forFeature(['permtest:read', 'permtest:write'])],
  controllers: [PermTestController],
})
class PermTestModule {}

/**
 * e2e tests for @Permission/Perm decorators behavior
 */
describe('Permissions Decorators (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  let tokenReader: string;
  let tokenWriter: string;
  let tokenRW: string;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule, PermTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const configService = app.get(ConfigService);
    const appConfig = configService.app;
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });

    await app.init();
    httpServer = app.getHttpServer() as Server;

    // baseline admin
    await createUser(app);

    await createUserWithPermissions(app, {
      username: 'perm_reader',
      password: 'ReaderPass123!',
      permissions: ['permtest:read'],
    });
    await createUserWithPermissions(app, {
      username: 'perm_writer',
      password: 'WriterPass123!',
      permissions: ['permtest:write'],
    });
    await createUserWithPermissions(app, {
      username: 'perm_rw',
      password: 'RWPass123!',
      permissions: ['permtest:read', 'permtest:write'],
    });

    tokenReader = await createAuthToken(app, {
      username: 'perm_reader',
      password: 'ReaderPass123!',
    });
    tokenWriter = await createAuthToken(app, {
      username: 'perm_writer',
      password: 'WriterPass123!',
    });
    tokenRW = await createAuthToken(app, {
      username: 'perm_rw',
      password: 'RWPass123!',
    });
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  describe('GET /api/v2/perm-test/a - @Permission("permtest", ["read"])', () => {
    it('401 without auth', async () => {
      await request(httpServer).get('/api/v2/perm-test/a').expect(401);
    });

    it('200 with permtest:read', async () => {
      await request(httpServer)
        .get('/api/v2/perm-test/a')
        .set('Authorization', `Bearer ${tokenReader}`)
        .expect(200);
    });

    it('403 with write only', async () => {
      await request(httpServer)
        .get('/api/v2/perm-test/a')
        .set('Authorization', `Bearer ${tokenWriter}`)
        .expect(403);
    });
  });

  describe('GET /api/v2/perm-test/b - @Permission("permtest:read","permtest:write")', () => {
    it('403 with read only', async () => {
      await request(httpServer)
        .get('/api/v2/perm-test/b')
        .set('Authorization', `Bearer ${tokenReader}`)
        .expect(403);
    });

    it('200 with read+write', async () => {
      await request(httpServer)
        .get('/api/v2/perm-test/b')
        .set('Authorization', `Bearer ${tokenRW}`)
        .expect(200);
    });
  });

  describe('GET /api/v2/perm-test/c - @Perm("permtest", ["write"])', () => {
    it('200 with write', async () => {
      await request(httpServer)
        .get('/api/v2/perm-test/c')
        .set('Authorization', `Bearer ${tokenWriter}`)
        .expect(200);
    });

    it('403 with read only', async () => {
      await request(httpServer)
        .get('/api/v2/perm-test/c')
        .set('Authorization', `Bearer ${tokenReader}`)
        .expect(403);
    });
  });
});
