import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AppModule } from '../src/app.module';
import { DATABASE_CONNECTION, type Database } from '../src/database';
import { siteMeta } from '../src/database/schema';
import { SettingRegistryService } from '../src/modules/setting/services/setting-registry.service';

import { cleanupDatabase } from './test-utils';

import type { INestApplication } from '@nestjs/common';

describe('SettingRegistryService Concurrency & Edge (e2e)', () => {
  let app: INestApplication;
  let registry: SettingRegistryService;
  let db: Database;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    registry = moduleFixture.get<SettingRegistryService>(SettingRegistryService);
    db = moduleFixture.get<Database>(DATABASE_CONNECTION);

    await app.init();
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDatabase(app);
  });

  it('should upsert concurrently into a single row for the same key', async () => {
    const key = 'e2e.concurrent.upsert';
    const total = 50;

    await Promise.all(
      Array.from({ length: total }, async (_, i) => {
        // small skew to encourage overlap
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5)));
        return registry.updateConfig(key, { n: i });
      }),
    );

    const rows = await db.select().from(siteMeta).where(eq(siteMeta.key, key));
    expect(rows).toHaveLength(1);

    const [final] = rows;
    expect(final.key).toBe(key);
    expect(final.value).toBeTypeOf('string');

    if (final.value == null) throw new Error('value should not be null');
    const parsed = JSON.parse(final.value);
    expect(parsed).toHaveProperty('n');
    expect(typeof parsed.n === 'number').toBe(true);
  }, 15000);

  it('should reject oversized payloads with BadRequestException', async () => {
    const key = 'e2e.edge.oversized';
    // construct ~300KB payload (above 256KB guard)
    const big = 'x'.repeat(300 * 1024);
    await expect(registry.updateConfig(key, { big })).rejects.toThrowError();

    const rows = await db.select().from(siteMeta).where(eq(siteMeta.key, key));
    expect(rows.length).toBe(0);
  }, 15000);
});
