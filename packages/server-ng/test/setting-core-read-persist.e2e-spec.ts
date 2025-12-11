import { Test, type TestingModule } from '@nestjs/testing';
import { siteMeta } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AppModule } from '../src/app.module';
import { DATABASE_CONNECTION, type Database } from '../src/database';
import { SettingCoreService } from '../src/modules/setting/services/setting-core.service';

import { cleanupDatabase } from './test-utils';

import type { INestApplication } from '@nestjs/common';

describe('SettingCoreService read-path default persistence (e2e)', () => {
  let app: INestApplication;
  let core: SettingCoreService;
  let db: Database;

  beforeAll(async () => {
    const appModule = AppModule.forRoot();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    core = moduleFixture.get<SettingCoreService>(SettingCoreService);
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

  it('should persist default on first read and return it', async () => {
    const key = 'e2e.core.read.persist';
    const def = { a: 1, b: 'x' } as const;

    const result = await core.getConfig<typeof def>(key, def);
    expect(result).toEqual(def);

    const rows = await db.select().from(siteMeta).where(eq(siteMeta.key, key));
    expect(rows).toHaveLength(1);

    const [row] = rows;
    expect(row.key).toBe(key);
    expect(row.value).toBeTypeOf('string');
    if (row.value == null) throw new Error('value should not be null');

    // Type assert value as string before JSON.parse
    const valueStr = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
    const parsed = JSON.parse(valueStr) as typeof def;
    expect(parsed).toMatchObject(def);
  }, 15000);

  it('should not overwrite stored value on subsequent reads with a different default', async () => {
    const key = 'e2e.core.read.persist.stable';
    const first = { n: 1 } as const;
    const second = { n: 999 } as const;

    const firstRead = await core.getConfig<typeof first>(key, first);
    expect(firstRead).toEqual(first);

    const secondRead = await core.getConfig<typeof second>(key, second);
    // Should return the stored value instead of the new default
    expect(secondRead).toEqual(first);

    const rows = await db.select().from(siteMeta).where(eq(siteMeta.key, key));
    expect(rows).toHaveLength(1);

    const [row] = rows;
    expect(row.value).toBeTypeOf('string');
    if (row.value == null) throw new Error('value should not be null');
    // Type assert value as string before JSON.parse
    const valueStr = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
    const parsed = JSON.parse(valueStr) as typeof first;
    expect(parsed.n).toBe(1);
  }, 15000);

  it('should persist one of the defaults when two concurrent first reads supply different defaults', async () => {
    const key = 'e2e.core.read.persist.concurrent.race';
    const defA = { v: 'A', n: 1 } as const;
    const defB = { v: 'B', n: 2 } as const;

    const [r1, r2] = await Promise.all([
      core.getConfig<typeof defA>(key, defA),
      core.getConfig<typeof defB>(key, defB),
    ]);

    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    // Each read should return one of the provided defaults, but they may differ due to race
    expect([defA, defB]).toContainEqual(r1);
    expect([defA, defB]).toContainEqual(r2);

    const rows = await db.select().from(siteMeta).where(eq(siteMeta.key, key));
    expect(rows).toHaveLength(1);

    const [row] = rows;
    expect(row.value).toBeTypeOf('string');
    if (row.value == null) throw new Error('value should not be null');
    // Type assert value as string before JSON.parse
    const valueStr = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
    const parsed = JSON.parse(valueStr) as { v: string; n: number };

    // Persisted value must be either defA or defB
    expect([
      { v: 'A', n: 1 },
      { v: 'B', n: 2 },
    ]).toContainEqual(parsed);

    // Subsequent reads without default should return the persisted value deterministically
    const followUp = await core.getConfig<typeof parsed>(key);
    expect(followUp).toEqual(parsed);
  }, 20000);

  it('should throw when default exceeds MAX_JSON_LENGTH during first read persistence', async () => {
    const key = 'e2e.core.read.persist.oversize';
    // Construct an oversized default: > 256KB JSON length
    const big = { data: 'a'.repeat(300_000) } as const;

    await expect(core.getConfig<typeof big>(key, big)).rejects.toThrow(
      /Config value too large for key/,
    );

    // Ensure nothing was persisted
    const rows = await db.select().from(siteMeta).where(eq(siteMeta.key, key));
    expect(rows).toHaveLength(0);
  }, 15000);
});
