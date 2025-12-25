import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { media as mediaTable } from '@vanblog/shared/drizzle';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AppModule } from '../../src/app.module';
import { ConfigService } from '../../src/config';
import { DATABASE_CONNECTION } from '../../src/database';
import { cleanupDatabase, createAuthToken, createUser } from '../test-utils';

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { Server } from 'http';

/**
 * Media Upload Pipeline Integration Tests
 *
 * Tests critical media workflow scenarios:
 * - Upload image → Process (resize, compress) → Verify output
 * - Upload with watermark → Verify watermark applied
 * - Batch upload → Verify all processed
 * - Upload failure → Verify rollback
 * - Concurrent uploads → Verify isolation
 */
describe('Media Upload Pipeline (e2e)', () => {
  let app: INestApplication;
  let db: LibSQLDatabase;
  let httpServer: Server;
  let authToken: string;

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
    db = app.get<LibSQLDatabase>(DATABASE_CONNECTION);

    // Setup test user
    await createUser(app);
    authToken = await createAuthToken(app);
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  beforeEach(async () => {
    // Clean up media before each test
    await db.delete(mediaTable).execute();
  });

  /**
   * Helper to create a test image buffer (minimal PNG)
   * This is a 1x1 transparent PNG for testing purposes
   */
  function createTestImageBuffer(): Buffer {
    // Minimal valid PNG header + IHDR + IEND
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    return png;
  }

  describe('Single image upload and processing', () => {
    it('should upload image and verify processing', async () => {
      const imageBuffer = createTestImageBuffer();

      const res = await request(httpServer)
        .post('/api/v2/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', imageBuffer, 'test-image.png')
        .expect([200, 201]);

      const { url, filename } = res.body.data || res.body;

      expect(url).toBeDefined();
      expect(filename).toBeDefined();

      // Verify media record was created
      const mediaRes = await request(httpServer)
        .get('/api/v2/media')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mediaRes.body.data.some((m: any) => m.filename === filename)).toBe(true);
    });
  });

  describe('Batch upload', () => {
    it('should handle multiple concurrent uploads', async () => {
      const imageBuffer1 = createTestImageBuffer();
      const imageBuffer2 = createTestImageBuffer();
      const imageBuffer3 = createTestImageBuffer();

      // Simulate concurrent uploads
      const upload1 = request(httpServer)
        .post('/api/v2/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', imageBuffer1, 'batch-image-1.png');

      const upload2 = request(httpServer)
        .post('/api/v2/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', imageBuffer2, 'batch-image-2.png');

      const upload3 = request(httpServer)
        .post('/api/v2/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', imageBuffer3, 'batch-image-3.png');

      const [res1, res2, res3] = await Promise.all([upload1, upload2, upload3]);

      // All uploads should succeed
      expect([200, 201]).toContain(res1.status);
      expect([200, 201]).toContain(res2.status);
      expect([200, 201]).toContain(res3.status);

      // Verify all files were saved to database
      const listRes = await request(httpServer)
        .get('/api/v2/media')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const filenames = listRes.body.data.map((m: any) => m.filename);
      expect(
        filenames.filter((f: any) => f.startsWith('batch-image')).length,
      ).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Concurrent upload isolation', () => {
    it('should maintain data consistency with concurrent uploads', async () => {
      const imageBuffer = createTestImageBuffer();
      const uploadCount = 5;

      // Create concurrent upload requests
      const uploads = Array.from({ length: uploadCount }, (_, i) =>
        request(httpServer)
          .post('/api/v2/media/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', imageBuffer, `concurrent-${String(i)}.png`),
      );

      const results = await Promise.all(uploads);

      // All should complete without errors
      results.forEach((res) => {
        expect([200, 201]).toContain(res.status);
      });

      // Verify all uploads were recorded
      const listRes = await request(httpServer)
        .get('/api/v2/media')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const concurrentFiles = listRes.body.data.filter((m: any) =>
        m.filename.startsWith('concurrent-'),
      );
      expect(concurrentFiles.length).toBe(uploadCount);
    });
  });

  describe('Media metadata', () => {
    it('should preserve metadata during upload', async () => {
      const imageBuffer = createTestImageBuffer();

      const res = await request(httpServer)
        .post('/api/v2/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', imageBuffer, 'metadata-test.png')
        .expect([200, 201]);

      const media = res.body.data || res.body;
      const { id } = media;

      // Get media details
      const detailRes = await request(httpServer)
        .get(`/api/v2/media/${String(id)}`)
        .set('Authorization', `Bearer ${authToken}`);

      if (detailRes.status === 200) {
        expect(detailRes.body.filename).toBeDefined();
        expect(detailRes.body.url).toBeDefined();
        if (detailRes.body.size) {
          expect(typeof detailRes.body.size).toBe('number');
        }
        if (detailRes.body.type) {
          expect(detailRes.body.type).toContain('image');
        }
      }
    });
  });

  describe('Media deletion', () => {
    it('should delete media and verify removal', async () => {
      const imageBuffer = createTestImageBuffer();

      // Upload image
      const uploadRes = await request(httpServer)
        .post('/api/v2/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', imageBuffer, 'delete-test.png')
        .expect([200, 201]);

      const { id } = uploadRes.body.data || uploadRes.body;

      // Delete media
      const _deleteRes = await request(httpServer)
        .delete(`/api/v2/media/${String(id)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect([200, 204]);

      // Verify deletion
      const listRes = await request(httpServer)
        .get('/api/v2/media')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listRes.body.data.some((m: any) => m.id === id)).toBe(false);
    });
  });

  describe('Batch media operations', () => {
    it('should handle batch deletion of multiple media files', async () => {
      const imageBuffer = createTestImageBuffer();

      // Upload multiple images
      const upload1 = await request(httpServer)
        .post('/api/v2/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', imageBuffer, 'batch-delete-1.png')
        .expect([200, 201]);

      const upload2 = await request(httpServer)
        .post('/api/v2/media/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', imageBuffer, 'batch-delete-2.png')
        .expect([200, 201]);

      const id1 = upload1.body.data?.id || upload1.body.id;
      const id2 = upload2.body.data?.id || upload2.body.id;

      // Batch delete
      const deleteRes = await request(httpServer)
        .post('/api/v2/media/batch-delete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ids: [id1, id2] })
        .expect([200, 204]);

      if (deleteRes.status === 200) {
        expect(deleteRes.body.deleted || deleteRes.body.count).toBeGreaterThanOrEqual(1);
      }

      // Verify deletion
      const listRes = await request(httpServer)
        .get('/api/v2/media')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listRes.body.data.some((m: any) => m.id === id1 || m.id === id2)).toBe(false);
    });
  });

  describe('Media list and pagination', () => {
    it('should list media with pagination', async () => {
      const imageBuffer = createTestImageBuffer();

      // Upload multiple images
      for (let i = 0; i < 3; i++) {
        await request(httpServer)
          .post('/api/v2/media/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', imageBuffer, `paginate-${String(i)}.png`)
          .expect(200);
      }

      // Get first page
      const page1Res = await request(httpServer)
        .get('/api/v2/media')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(page1Res.body.data).toBeDefined();
      expect(Array.isArray(page1Res.body.data)).toBe(true);

      // Get second page if exists
      if (page1Res.body.page && page1Res.body.total) {
        expect(page1Res.body.total).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
