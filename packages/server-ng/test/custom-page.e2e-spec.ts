import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';
import { DATABASE_CONNECTION } from '../src/database';
import { customPages } from '../src/database/schema';

import { createUser, cleanupDatabase } from './test-utils';

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { Server } from 'http';

describe('CustomPageController (e2e)', () => {
  let app: INestApplication;
  let db: LibSQLDatabase;

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

    // Get database connection for test data setup
    db = app.get<LibSQLDatabase>(DATABASE_CONNECTION);

    // Create admin user
    await createUser(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  beforeEach(async () => {
    // Clean up custom pages before each test
    await db.delete(customPages).execute();
  });

  describe('GET /api/v2/public/customPage/all', () => {
    it('should return empty array when no custom pages exist', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/public/customPage/all')
        .expect(200);

      expect(response.body).toMatchObject({
        statusCode: 200,
        data: [],
      });
    });

    it('should return all custom pages', async () => {
      // Insert test data
      await db.insert(customPages).values([
        {
          title: 'About Us',
          pathname: '/about',
          content: '# About Us\nThis is our story.',
          type: 'markdown',
        },
        {
          title: 'Contact',
          pathname: '/contact',
          content: '<h1>Contact Us</h1><p>Email: test@example.com</p>',
          type: 'html',
        },
      ]);

      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/public/customPage/all')
        .expect(200);

      expect(response.body).toMatchObject({
        statusCode: 200,
        data: [
          {
            name: 'About Us',
            path: '/about',
          },
          {
            name: 'Contact',
            path: '/contact',
          },
        ],
      });
    });
  });

  describe('GET /api/v2/public/customPage', () => {
    beforeEach(async () => {
      // Insert test data for each test
      await db.insert(customPages).values([
        {
          title: 'About Us',
          pathname: '/about',
          content: '# About Us\nThis is our story.',
          type: 'markdown',
        },
        {
          title: 'Contact',
          pathname: '/contact',
          content: '<h1>Contact Us</h1><p>Email: test@example.com</p>',
          type: 'html',
        },
      ]);
    });

    it('should require path parameter', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/public/customPage')
        .expect(404);

      expect(response.body.message).toContain('Path parameter is required');
    });

    it('should return 404 for non-existent custom page', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/public/customPage')
        .query({ path: '/non-existent' })
        .expect(404);

      expect(response.body.message).toContain('Custom page not found for path: /non-existent');
    });

    it('should return markdown custom page with rendered HTML', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/public/customPage')
        .query({ path: '/about' })
        .expect(200);

      expect(response.body).toMatchObject({
        statusCode: 200,
        data: {
          name: 'About Us',
          path: '/about',
          html: expect.stringContaining('<h1>About Us</h1>'),
        },
      });

      // Verify markdown was rendered to HTML
      expect(response.body.data.html).toContain('<h1>About Us</h1>');
      expect(response.body.data.html).toContain('<p>This is our story.</p>');
    });

    it('should return HTML custom page as-is', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v2/public/customPage')
        .query({ path: '/contact' })
        .expect(200);

      expect(response.body).toMatchObject({
        statusCode: 200,
        data: {
          name: 'Contact',
          path: '/contact',
          html: '<h1>Contact Us</h1><p>Email: test@example.com</p>',
        },
      });
    });
  });
});
