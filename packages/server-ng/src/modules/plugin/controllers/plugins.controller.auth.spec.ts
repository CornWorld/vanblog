import 'reflect-metadata';

// External libs
import {
  UnauthorizedException,
  VersioningType,
  type INestApplication,
  type CanActivate,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, it } from 'vitest';

// App imports
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { LoaderService } from '../services/loader.service';

import { PluginsController } from './plugins.controller';

// Minimal mock for LoaderService
const createLoaderMock = (): Pick<
  LoaderService,
  'getLoadedPlugins' | 'reloadPlugins' | 'unloadPlugin'
> => ({
  getLoadedPlugins: () => new Map(),
  reloadPlugins: async () => Promise.resolve(),
  unloadPlugin: async (_name: string) => Promise.resolve(false),
});

describe('PluginsController (auth/permission guards)', () => {
  let app: INestApplication | null = null;

  // Each test creates its own app with desired guard behaviors
  async function createAppWithGuards(guardImpls: {
    jwt?: CanActivate;
    role?: CanActivate;
    perm?: CanActivate;
  }): Promise<INestApplication> {
    const moduleBuilder = Test.createTestingModule({
      controllers: [PluginsController],
      providers: [{ provide: LoaderService, useValue: createLoaderMock() }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardImpls.jwt ?? { canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue(guardImpls.role ?? { canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue(guardImpls.perm ?? { canActivate: () => true });

    const moduleRef = await moduleBuilder.compile();

    const nestApp = moduleRef.createNestApplication();
    nestApp.enableVersioning({ type: VersioningType.URI });
    await nestApp.init();
    return nestApp;
  }

  // Ensure app closed after each test in case a test forgets to close it locally
  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('GET /v2/admin/plugins should return 401 when JwtAuthGuard denies', async () => {
    app = await createAppWithGuards({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException();
        },
      },
    });

    await request(app.getHttpServer()).get('/v2/admin/plugins').expect(401);
  });

  it('GET /v2/admin/plugins should return 403 when permission is missing', async () => {
    app = await createAppWithGuards({
      jwt: { canActivate: () => true },
      perm: { canActivate: () => false },
    });

    await request(app.getHttpServer()).get('/v2/admin/plugins').expect(403);
  });

  it('POST /v2/admin/plugins/reload should return 403 when permission is missing', async () => {
    app = await createAppWithGuards({
      jwt: { canActivate: () => true },
      perm: { canActivate: () => false },
    });

    await request(app.getHttpServer()).post('/v2/admin/plugins/reload').expect(403);
  });

  it('DELETE /v2/admin/plugins/:name should return 403 when permission is missing', async () => {
    app = await createAppWithGuards({
      jwt: { canActivate: () => true },
      perm: { canActivate: () => false },
    });

    await request(app.getHttpServer()).delete('/v2/admin/plugins/foo').expect(403);
  });
});
