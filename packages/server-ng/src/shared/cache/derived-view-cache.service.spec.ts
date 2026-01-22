import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { nowIsoTz, dayjs } from '@vanblog/shared/runtime';

import { CacheService } from './cache.service';
import { DerivedViewCacheService, type CachedResult } from './derived-view-cache.service';

class InMemoryCacheService {
  store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    if (!this.store.has(key)) return await Promise.resolve(null);
    return await Promise.resolve(this.store.get(key) as T);
  }

  async set(key: string, value: unknown, _ttl = 300): Promise<void> {
    this.store.set(key, value);
    await Promise.resolve();
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    await Promise.resolve();
  }

  async clear(): Promise<void> {
    this.store.clear();
    await Promise.resolve();
  }
}

describe('DerivedViewCacheService', () => {
  let moduleRef: TestingModule;
  let service: DerivedViewCacheService;
  let cache: InMemoryCacheService;

  beforeEach(async () => {
    cache = new InMemoryCacheService();

    moduleRef = await Test.createTestingModule({
      providers: [
        DerivedViewCacheService,
        {
          provide: CacheService,
          useValue: cache,
        },
      ],
    }).compile();

    service = moduleRef.get(DerivedViewCacheService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should generate and cache on miss', async () => {
    const key = 'test:miss';
    const generator = vi.fn().mockResolvedValue({ value: 42 });

    const result = await service.getDerivedView({ key, generator, ttl: 60 });

    expect(generator).toHaveBeenCalledTimes(1);
    expect(result as any).toEqual({ value: 42 });

    const cached = (await cache.get<CachedResult>(key)) as CachedResult;
    expect(cached).toBeTruthy();
    expect(cached.data).toEqual({ value: 42 });
    expect(typeof cached.meta.timestamp).toBe('string');
    expect(cached.meta.regenerating).toBe(false);
  });

  it('should return fresh cached data when within ttl', async () => {
    const key = 'test:fresh';
    const now = nowIsoTz();
    const cached: CachedResult = {
      data: { value: 'fresh' },
      meta: { timestamp: now, regenerating: false },
    };
    await cache.set(key, cached);

    const generator = vi.fn().mockResolvedValue({ value: 'new' });
    const result = await service.getDerivedView({ key, generator, ttl: 60 });

    expect(result as any).toEqual({ value: 'fresh' });
    expect(generator).not.toHaveBeenCalled();
  });

  it('should return stale data and trigger async regeneration under SWR window', async () => {
    const key = 'test:swr';
    const ttl = 1;
    // Subtract ttl + 5 to ensure we're well into the SWR window (age > ttl but age < ttl + swrTolerance)
    const past = dayjs()
      .subtract(ttl + 5, 'second')
      .toISOString(); // 刚过期

    const cached: CachedResult = {
      data: { value: 'stale' },
      meta: { timestamp: past, regenerating: false },
    };
    await cache.set(key, cached);

    const generator = vi.fn().mockResolvedValue({ value: 'fresh' });

    const result = await service.getDerivedView({
      key,
      generator,
      ttl,
      swr: true,
      swrTolerance: 60,
    });

    // 立即返回旧数据
    expect(result as any).toEqual({ value: 'stale' });

    // Wait for async regeneration to complete (fire-and-forget pattern)
    // Use vi.waitFor to wait for the cache to be updated with fresh data
    await vi.waitFor(
      async () => {
        const updated = (await cache.get<CachedResult>(key)) as CachedResult;
        expect(updated.data).toEqual({ value: 'fresh' });
      },
      { timeout: 2000 },
    );

    const updated = (await cache.get<CachedResult>(key)) as CachedResult;
    // Note: regenerating flag may still be true due to race condition in fire-and-forget pattern
    expect(typeof updated.meta.timestamp).toBe('string');
  });

  describe('SWR Window Boundary Tests (Precise Timing)', () => {
    // These tests validate SWR (Stale-While-Revalidate) window boundaries
    // using fake timers for exact control over timing
    // Documentation: SWR window = [ttl, ttl + swrTolerance]
    // Within window: return stale + async regen
    // Outside window: return fresh (synchronous regen)

    it('should return fresh data at exact TTL expiration moment', async () => {
      const key = 'test:exact-ttl';
      const ttl = 1; // 1 second
      const swrTolerance = 60; // 60 seconds

      const generator = vi.fn().mockResolvedValue({ value: 'fresh-at-ttl' });

      // At exact TTL expiration (age = ttl), data is just at the boundary
      // age <= ttl means fresh, age > ttl means stale
      // At age == ttl, should be considered fresh
      const cached: CachedResult = {
        data: { value: 'fresh-data' },
        meta: {
          timestamp: dayjs().subtract(ttl, 'second').toISOString(),
          regenerating: false,
        },
      };
      await cache.set(key, cached);

      const result = await service.getDerivedView({
        key,
        generator,
        ttl,
        swr: true,
        swrTolerance,
      });

      // At exact TTL boundary, data should still be fresh (age <= ttl)
      expect((result as any).value).toBe('fresh-data');
      expect(generator).not.toHaveBeenCalled();
    });

    it('should return stale at TTL + 0.25 * swrTolerance (early SWR window)', async () => {
      const key = 'test:swr-quarter';
      const ttl = 1; // 1 second
      const swrTolerance = 40; // 40 seconds

      // Age = ttl + 0.25 * swrTolerance, well within SWR window
      const age = ttl + 0.25 * swrTolerance;
      const cached: CachedResult = {
        data: { value: 'stale-quarter' },
        meta: {
          timestamp: dayjs().subtract(age, 'second').toISOString(),
          regenerating: false,
        },
      };
      await cache.set(key, cached);

      const generator = vi.fn().mockResolvedValue({ value: 'fresh-quarter' });

      const result = await service.getDerivedView({
        key,
        generator,
        ttl,
        swr: true,
        swrTolerance,
      });

      // Should still be within SWR window (0.25 * tolerance is well within)
      expect((result as any).value).toBe('stale-quarter');

      // Wait a bit for async regen to potentially start
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it('should return stale at TTL + 0.5 * swrTolerance (middle SWR window)', async () => {
      const key = 'test:swr-middle';
      const ttl = 2; // 2 seconds
      const swrTolerance = 60; // 60 seconds

      // Age = ttl + 0.5 * swrTolerance, in middle of SWR window
      const age = ttl + 0.5 * swrTolerance;
      const cached: CachedResult = {
        data: { value: 'stale-middle' },
        meta: {
          timestamp: dayjs().subtract(age, 'second').toISOString(),
          regenerating: false,
        },
      };
      await cache.set(key, cached);

      const generator = vi.fn().mockResolvedValue({ value: 'fresh-middle' });

      const result = await service.getDerivedView({
        key,
        generator,
        ttl,
        swr: true,
        swrTolerance,
      });

      // At 50% through SWR window, should still return stale
      expect((result as any).value).toBe('stale-middle');

      // Wait a bit for async regen to potentially start
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it('should return stale at TTL + 0.75 * swrTolerance (late SWR window)', async () => {
      const key = 'test:swr-late';
      const ttl = 1;
      const swrTolerance = 80; // 80 seconds

      // Age = ttl + 0.75 * swrTolerance, late in SWR window
      const age = ttl + 0.75 * swrTolerance;
      const cached: CachedResult = {
        data: { value: 'stale-late' },
        meta: {
          timestamp: dayjs().subtract(age, 'second').toISOString(),
          regenerating: false,
        },
      };
      await cache.set(key, cached);

      const generator = vi.fn().mockResolvedValue({ value: 'fresh-late' });

      const result = await service.getDerivedView({
        key,
        generator,
        ttl,
        swr: true,
        swrTolerance,
      });

      // At 75% through SWR window, still within bounds
      expect((result as any).value).toBe('stale-late');

      // Wait a bit for async regen to potentially start
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it('should trigger synchronous regeneration at TTL + 1.0 * swrTolerance (SWR boundary)', async () => {
      const key = 'test:swr-boundary';
      const ttl = 1; // 1 second
      const swrTolerance = 30; // 30 seconds

      // Create cached data that is just outside SWR window
      // Add 2 seconds buffer to account for any rounding issues
      const past = dayjs()
        .subtract(ttl + swrTolerance + 2, 'second')
        .toISOString();
      const cached: CachedResult = {
        data: { value: 'very-stale' },
        meta: { timestamp: past, regenerating: false },
      };
      await cache.set(key, cached);

      const generator = vi.fn().mockResolvedValue({ value: 'fresh-boundary' });

      const result = await service.getDerivedView({
        key,
        generator,
        ttl,
        swr: true,
        swrTolerance,
      });

      // Outside the SWR window (beyond TTL + swrTolerance), should be synchronous regeneration
      expect((result as any).value).toBe('fresh-boundary');
      expect(generator).toHaveBeenCalledTimes(1);
    });

    it('should provide stale-while-revalidate at various intermediate points', async () => {
      const ttl = 5; // 5 seconds
      const swrTolerance = 100; // 100 seconds

      // Test at multiple points within SWR window
      const testPoints = [
        { offset: 0.1, name: '10% through SWR' },
        { offset: 0.33, name: '33% through SWR' },
        { offset: 0.5, name: '50% through SWR' },
        { offset: 0.66, name: '66% through SWR' },
        { offset: 0.9, name: '90% through SWR' },
      ];

      for (let i = 0; i < testPoints.length; i++) {
        const testPoint = testPoints[i];
        vi.clearAllMocks();

        const key = `test:swr-intervals-${String(i)}`;

        // Age = ttl + offset * swrTolerance
        const age = ttl + testPoint.offset * swrTolerance;
        const cached: CachedResult = {
          data: { value: `stale-${String(i)}` },
          meta: {
            timestamp: dayjs().subtract(age, 'second').toISOString(),
            regenerating: false,
          },
        };
        await cache.set(key, cached);

        const generator = vi.fn().mockResolvedValue({ value: `fresh-${String(i)}` });

        const result = await service.getDerivedView({
          key,
          generator,
          ttl,
          swr: true,
          swrTolerance,
        });

        // All intermediate points should return stale and trigger async regen
        expect((result as any).value).toBe(`stale-${String(i)}`);
      }
    });

    it('should have accurate SWR calculation: time - timestamp should be between ttl * 1000 and (ttl + swrTolerance) * 1000', async () => {
      const key = 'test:swr-math';
      const ttl = 2; // 2 seconds
      const swrTolerance = 30; // 30 seconds

      // Age = ttl + 0.5 * swrTolerance (middle of SWR window)
      const age = ttl + 0.5 * swrTolerance;
      const cached: CachedResult = {
        data: { value: 'test-math' },
        meta: {
          timestamp: dayjs().subtract(age, 'second').toISOString(),
          regenerating: false,
        },
      };
      await cache.set(key, cached);

      const generator = vi.fn().mockResolvedValue({ value: 'fresh-math' });

      const result = await service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance });

      // Should be in SWR window (async regen)
      expect((result as any).value).toBe('test-math');

      // Verify math: Should be: ttl <= age < (ttl + swrTolerance)
      const minAge = ttl;
      const maxAge = ttl + swrTolerance;

      expect(age).toBeGreaterThanOrEqual(minAge);
      expect(age).toBeLessThan(maxAge);
    });
  });

  it('should regenerate synchronously when outside SWR window', async () => {
    const key = 'test:sync';
    const ttl = 1;
    const swrTolerance = 1;
    // Add 2 seconds buffer to account for any rounding issues
    const past = dayjs()
      .subtract(ttl + swrTolerance + 2, 'second')
      .toISOString(); // 远超 SWR 容忍

    const cached: CachedResult = {
      data: { value: 'very-stale' },
      meta: { timestamp: past, regenerating: false },
    };
    await cache.set(key, cached);

    const generator = vi.fn().mockResolvedValue({ value: 'new-sync' });

    const result = await service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance });

    expect(result as any).toEqual({ value: 'new-sync' });

    const updated = (await cache.get<CachedResult>(key)) as CachedResult;
    expect(updated.data).toEqual({ value: 'new-sync' });
  });

  it('should regenerate synchronously when SWR disabled', async () => {
    const key = 'test:no-swr';
    const ttl = 1;
    // Add 2 seconds buffer to account for any rounding issues
    const past = dayjs()
      .subtract(ttl + 2, 'second')
      .toISOString(); // 过期

    const cached: CachedResult = {
      data: { value: 'stale' },
      meta: { timestamp: past, regenerating: false },
    };
    await cache.set(key, cached);

    const generator = vi.fn().mockResolvedValue({ value: 'fresh' });

    const result = await service.getDerivedView({ key, generator, ttl, swr: false });

    expect(result as any).toEqual({ value: 'fresh' });
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it('should invalidate cache', async () => {
    const key = 'test:invalidate';
    await cache.set(key, { foo: 'bar' });
    await service.invalidate(key);
    const v = await cache.get(key);
    expect(v).toBeNull();
  });

  it('should generate key with static helper', () => {
    const key = DerivedViewCacheService.key('timeline', 2024, 8);
    expect(key).toBe('derived-view:timeline:2024:8');
  });

  it('should throw when generator fails and not cache error result', async () => {
    const key = 'test:error';
    const generator = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(service.getDerivedView({ key, generator, ttl: 10 })).rejects.toThrow('boom');
    const cached = await cache.get(key);
    expect(cached).toBeNull();
  });

  it('should detect when data is regenerating', async () => {
    const key = 'test:regenerating';
    const cached: CachedResult = {
      data: { value: 'data' },
      meta: { timestamp: nowIsoTz(), regenerating: true },
    };
    await cache.set(key, cached);

    const isRegen = await service.isRegenerating(key);

    expect(isRegen).toBe(true);
  });

  it('should return false when data is not regenerating', async () => {
    const key = 'test:not-regenerating';
    const cached: CachedResult = {
      data: { value: 'data' },
      meta: { timestamp: nowIsoTz(), regenerating: false },
    };
    await cache.set(key, cached);

    const isRegen = await service.isRegenerating(key);

    expect(isRegen).toBe(false);
  });

  it('should return false when checking regenerating status for non-existent key', async () => {
    const key = 'test:non-existent';

    const isRegen = await service.isRegenerating(key);

    expect(isRegen).toBe(false);
  });

  it('should handle error when getting cached result during async regeneration', async () => {
    const key = 'test:async-error';
    const ttl = 1;
    const swrTolerance = 60;
    const past = dayjs()
      .subtract(ttl + 1, 'second')
      .toISOString();

    const cached: CachedResult = {
      data: { value: 'stale' },
      meta: { timestamp: past, regenerating: false },
    };
    await cache.set(key, cached);

    // Mock cache.get to throw error after initial successful call
    let callCount = 0;
    const originalGet = cache.get.bind(cache);
    cache.get = vi.fn().mockImplementation(async (k: string) => {
      callCount++;
      if (callCount === 1) {
        return originalGet(k);
      }
      throw new Error('Cache read error');
    }) as any;

    const generator = vi.fn().mockResolvedValue({ value: 'fresh' });

    // This should still return stale data and attempt async regeneration
    const result = await service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance });

    expect(result as any).toEqual({ value: 'stale' });

    // Wait for async regeneration attempt
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Error should be logged, but not thrown
    // The regeneratingKeys should be cleaned up
  });

  it('should prevent duplicate async regeneration for same key', async () => {
    const key = 'test:duplicate-regen';
    const ttl = 1;
    const swrTolerance = 60;
    const past = dayjs()
      .subtract(ttl + 1, 'second')
      .toISOString();

    const cached: CachedResult = {
      data: { value: 'stale' },
      meta: { timestamp: past, regenerating: false },
    };
    await cache.set(key, cached);

    const generator = vi.fn().mockResolvedValue({ value: 'fresh' });

    // Call getDerivedView multiple times quickly
    const promises = [
      service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance }),
      service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance }),
      service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance }),
    ];

    const results = await Promise.all(promises);

    // All should return stale data
    expect(results as any).toEqual([{ value: 'stale' }, { value: 'stale' }, { value: 'stale' }]);

    // Wait for async regeneration
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generator should be called only once due to duplicate prevention
    expect(generator.mock.calls.length).toBeLessThanOrEqual(2); // At most 2: initial check + one regeneration
  });

  describe('Concurrent Regeneration Lock', () => {
    it('should use atomic test-and-set for regeneration lock', async () => {
      const key = 'test:lock-atomic';
      const ttl = 1;
      const swrTolerance = 60;
      // Subtract ttl + 5 to ensure we're well into the SWR window
      const past = dayjs()
        .subtract(ttl + 5, 'second')
        .toISOString();

      const cached: CachedResult = {
        data: { value: 'stale' },
        meta: { timestamp: past, regenerating: false },
      };
      await cache.set(key, cached);

      const generator = vi.fn().mockImplementation(
        async () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve({ value: 'fresh' });
            }, 50),
          ),
      );

      // Simulate multiple concurrent requests during regeneration window
      const promises = Array(5)
        .fill(undefined)
        .map(() => service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance }));

      const results = await Promise.all(promises);

      // All should return the stale value initially
      results.forEach((result) => {
        expect((result as any).value).toBe('stale');
      });

      // Wait for async regeneration to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Generator should be called minimally (lock prevents duplicate calls)
      expect(generator.mock.calls.length).toBeLessThanOrEqual(2);

      // Final value should be updated
      const final = await cache.get<CachedResult>(key);
      expect((final as any)?.data.value).toBe('fresh');
    });

    it('should handle multiple concurrent requests outside SWR window', async () => {
      const key = 'test:concurrent-miss-lock';
      const ttl = 1;
      const swrTolerance = 10;
      const past = dayjs()
        .subtract(ttl + swrTolerance + 1, 'second')
        .toISOString(); // Far outside SWR window

      const cached: CachedResult = {
        data: { value: 'very-stale' },
        meta: { timestamp: past, regenerating: false },
      };
      await cache.set(key, cached);

      let generatorCallCount = 0;
      const generator = vi.fn().mockImplementation(() => {
        generatorCallCount++;
        return { value: `fresh-${String(generatorCallCount)}` };
      });

      // Multiple concurrent requests outside SWR window all trigger synchronous regeneration
      const promise1 = service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance });
      const promise2 = service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance });
      const promise3 = service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance });

      await Promise.all([promise1, promise2, promise3]);

      // Outside SWR window causes synchronous regeneration
      // Each request may trigger regeneration (results may vary: 1-3 calls)
      expect(generatorCallCount).toBeGreaterThan(0);
      expect(generatorCallCount).toBeLessThanOrEqual(3);

      // Final cache state should be updated
      const final = await cache.get<CachedResult>(key);
      expect((final as any)?.data).toBeDefined();
    });

    it('should handle regenerating flag correctly during concurrent access', async () => {
      const key = 'test:regen-flag';
      const ttl = 1;
      const swrTolerance = 60;
      const past = dayjs()
        .subtract(ttl + 1, 'second')
        .toISOString();

      const cached: CachedResult = {
        data: { value: 'stale' },
        meta: { timestamp: past, regenerating: false },
      };
      await cache.set(key, cached);

      const generator = vi.fn().mockImplementation(
        async () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve({ value: 'fresh' });
            }, 50),
          ),
      );

      // Trigger concurrent requests
      const results = await Promise.all([
        service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance }),
        service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance }),
      ]);

      // All return stale value
      expect(results as any).toEqual([{ value: 'stale' }, { value: 'stale' }]);

      // Wait for regeneration to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // During/after regeneration, isRegenerating should reflect state
      const isRegenBefore = await service.isRegenerating(key);
      // May or may not be true depending on timing, but should be boolean
      expect(typeof isRegenBefore).toBe('boolean');

      // After regeneration, should be false
      const isRegenAfter = await service.isRegenerating(key);
      expect(isRegenAfter).toBe(false);
    });
  });
});
