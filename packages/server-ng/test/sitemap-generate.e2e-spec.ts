import * as fs from 'fs/promises';
import * as path from 'path';

import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService as AppConfigService } from '../src/config';
import { DATABASE_CONNECTION, type Database } from '../src/database';
import { siteMeta } from '@vanblog/shared/drizzle';

import { createUserWithPermissions, createAuthToken, cleanupDatabase } from './test-utils';

import type { Server } from 'http';

/**
 * e2e tests that actually generate sitemap.xml to disk and validate its content
 */
describe('SitemapController - generate & XML (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let db: Database;

  let generatorToken: string; // has sitemap:generate + sitemap:read

  const getSitemapXmlPath = (): string => {
    const config = app.get(AppConfigService);
    const staticDir = config.static.path;
    return path.join(staticDir, 'sitemap', 'sitemap.xml');
  };

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    const configService = app.get(AppConfigService);
    const appConfig = configService.app;
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });
    await app.init();
    httpServer = app.getHttpServer() as Server;

    // DB handle for inserting settings
    db = app.get<Database>(DATABASE_CONNECTION);

    // Ensure a clean slate: remove existing sitemap file if present and clear siteUrl setting
    try {
      const xmlPathAtStart = getSitemapXmlPath();
      await fs.rm(xmlPathAtStart, { force: true });
    } catch {
      // ignore
    }
    await db.delete(siteMeta).where(eq(siteMeta.key, 'siteUrl'));

    // Create user that can generate sitemap
    await createUserWithPermissions(app, {
      username: 'sitemap_gen',
      password: 'GenPass123!',
      permissions: ['sitemap:generate', 'sitemap:read'],
    });
    generatorToken = await createAuthToken(app, {
      username: 'sitemap_gen',
      password: 'GenPass123!',
    });
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  it('POST /api/v2/sitemap/generate should create sitemap.xml with basic URLs', async () => {
    // Trigger generation
    const res = await request(httpServer)
      .post('/api/v2/sitemap/generate')
      .set('Authorization', `Bearer ${generatorToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('message');

    // Read generated XML from disk
    const xmlPath = getSitemapXmlPath();
    const xml = await fs.readFile(xmlPath, 'utf8');

    // Minimal checks
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<urlset');
    // Default baseUrl falls back to http://localhost:3000 when setting missing
    expect(xml).toContain('<loc>http://localhost:3000/</loc>');
  });

  it('should respect settings.sitemapExtraStaticPaths and include extra URLs', async () => {
    // Upsert setting to DB directly (ensure no unique key conflict)
    await db.delete(siteMeta).where(eq(siteMeta.key, 'sitemapExtraStaticPaths'));
    await db.insert(siteMeta).values({
      key: 'sitemapExtraStaticPaths',
      value: JSON.stringify(['/extra-e2e']),
    });

    // Re-generate
    await request(httpServer)
      .post('/api/v2/sitemap/generate')
      .set('Authorization', `Bearer ${generatorToken}`)
      .expect(200);

    // Validate XML contains the extra URL
    const xmlPath = getSitemapXmlPath();
    const xml = await fs.readFile(xmlPath, 'utf8');
    expect(xml).toContain('<loc>http://localhost:3000/extra-e2e</loc>');
  });
});
