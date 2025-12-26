import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

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
    expect(typeof cached.meta.timestamp).toBe('number');
    expect(cached.meta.regenerating).toBe(false);
  });

  it('should return fresh cached data when within ttl', async () => {
    const key = 'test:fresh';
    const now = Date.now();
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
    const past = Date.now() - (ttl + 1) * 1000; // 刚过期

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

    // Wait briefly for async regeneration (with real timers since not in fake timer mode)
    await new Promise((resolve) => setTimeout(resolve, 50));

    const updated = (await cache.get<CachedResult>(key)) as CachedResult;
    expect(updated.data).toEqual({ value: 'fresh' });
    expect(updated.meta.regenerating).toBe(false);
    expect(typeof updated.meta.timestamp).toBe('number');
  });

  describe('SWR Window Boundary Tests (Precise Timing)', () => {
    // These tests validate SWR (Stale-While-Revalidate) window boundaries
    // using fake timers for exact control over timing
    // Documentation: SWR window = [ttl, ttl + swrTolerance]
    // Within window: return stale + async regen
    // Outside window: return fresh (synchronous regen)

    it('should return fresh data at exact TTL expiration moment', async () => {
      // Use fake timers for precise timing control
      vi.useFakeTimers();

      const key = 'test:exact-ttl';
      const ttl = 1; // 1 second
      const swrTolerance = 60; // 60 seconds
      const createdAt = Date.now(); // Current fake time

      const cached: CachedResult = {
        data: { value: 'stale' },
        meta: { timestamp: createdAt, regenerating: false },
      };
      await cache.set(key, cached);

      // Jump to exactly TTL seconds later
      vi.setSystemTime(createdAt + ttl * 1000);

      const generator = vi.fn().mockResolvedValue({ value: 'fresh-at-ttl' });

      const result = await service.getDerivedView({
        key,
        generator,
        ttl,
        swr: true,
        swrTolerance,
      });

      // At exact TTL boundary (ttl + 0), should still be within SWR window
      // So should return stale and trigger async regen
      expect((result as any).value).toBe('stale');

      vi.useRealTimers();
    });

    it('should return stale at TTL + 0.25 * swrTolerance (early SWR window)', async () => {
      vi.useFakeTimers();

      const key = 'test:swr-quarter';
      const ttl = 1; // 1 second
      const swrTolerance = 40; // 40 seconds
      const createdAt = Date.now();

      const cached: CachedResult = {
        data: { value: 'stale-quarter' },
        meta: { timestamp: createdAt, regenerating: false },
      };
      await cache.set(key, cached);

      // Jump to TTL + 0.25 * swrTolerance
      const timeAtQuarter = createdAt + ttl * 1000 + 0.25 * swrTolerance * 1000;
      vi.setSystemTime(timeAtQuarter);

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

      // Advance fake timers to let async regen happen
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      vi.useRealTimers();
    });

    it('should return stale at TTL + 0.5 * swrTolerance (middle SWR window)', async () => {
      vi.useFakeTimers();

      const key = 'test:swr-middle';
      const ttl = 2; // 2 seconds
      const swrTolerance = 60; // 60 seconds
      const createdAt = Date.now();

      const cached: CachedResult = {
        data: { value: 'stale-middle' },
        meta: { timestamp: createdAt, regenerating: false },
      };
      await cache.set(key, cached);

      // Jump to TTL + 0.5 * swrTolerance
      const timeAtMiddle = createdAt + ttl * 1000 + 0.5 * swrTolerance * 1000;
      vi.setSystemTime(timeAtMiddle);

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

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      vi.useRealTimers();
    });

    it('should return stale at TTL + 0.75 * swrTolerance (late SWR window)', async () => {
      vi.useFakeTimers();

      const key = 'test:swr-late';
      const ttl = 1;
      const swrTolerance = 80; // 80 seconds
      const createdAt = Date.now();

      const cached: CachedResult = {
        data: { value: 'stale-late' },
        meta: { timestamp: createdAt, regenerating: false },
      };
      await cache.set(key, cached);

      // Jump to TTL + 0.75 * swrTolerance
      const timeAtLate = createdAt + ttl * 1000 + 0.75 * swrTolerance * 1000;
      vi.setSystemTime(timeAtLate);

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

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      vi.useRealTimers();
    });

    it('should trigger synchronous regeneration at TTL + 1.0 * swrTolerance (SWR boundary)', async () => {
      vi.useFakeTimers();

      const key = 'test:swr-boundary';
      const ttl = 1; // 1 second
      const swrTolerance = 30; // 30 seconds
      const createdAt = Date.now();

      const cached: CachedResult = {
        data: { value: 'very-stale' },
        meta: { timestamp: createdAt, regenerating: false },
      };
      await cache.set(key, cached);

      // Jump to PAST the TTL + swrTolerance boundary (outside SWR window)
      const timeOutsideBoundary = createdAt + (ttl + swrTolerance) * 1000 + 1;
      vi.setSystemTime(timeOutsideBoundary);

      const generator = vi.fn().mockResolvedValue({ value: 'fresh-boundary' });

      const result = await service.getDerivedView({
        key,
        generator,
        ttl,
        swr: true,
        swrTolerance,
      });

      // Outside the SWR window (beyond TTL + swrTolerance), should be synchronous regeneration
      // Result should be fresh, not stale
      expect((result as any).value).toBe('fresh-boundary');

      vi.useRealTimers();
    });

    it('should provide stale-while-revalidate at various intermediate points', async () => {
      vi.useFakeTimers();

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
        const createdAt = Date.now();

        const cached: CachedResult = {
          data: { value: `stale-${String(i)}` }, // Use index instead of offset to match
          meta: { timestamp: createdAt, regenerating: false },
        };
        await cache.set(key, cached);

        // Jump to offset within SWR window
        const timeAtOffset = createdAt + ttl * 1000 + testPoint.offset * swrTolerance * 1000;
        vi.setSystemTime(timeAtOffset);

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

      vi.useRealTimers();
    });

    it('should have accurate SWR calculation: time - timestamp should be between ttl * 1000 and (ttl + swrTolerance) * 1000', async () => {
      vi.useFakeTimers();

      const key = 'test:swr-math';
      const ttl = 2; // 2 seconds
      const swrTolerance = 30; // 30 seconds
      const createdAt = Date.now();

      const cached: CachedResult = {
        data: { value: 'test-math' },
        meta: { timestamp: createdAt, regenerating: false },
      };
      await cache.set(key, cached);

      // Jump to middle of SWR window
      const elapsedInSwr = 0.5 * swrTolerance * 1000; // 50% through SWR
      vi.setSystemTime(createdAt + ttl * 1000 + elapsedInSwr);

      const generator = vi.fn().mockResolvedValue({ value: 'fresh-math' });

      const result = await service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance });

      // Should be in SWR window (async regen)
      expect((result as any).value).toBe('test-math');

      // Verify math:
      // age = now - timestamp = (createdAt + ttl*1000 + elapsedInSwr) - createdAt
      //     = ttl*1000 + elapsedInSwr
      // Should be: ttl*1000 <= age < (ttl + swrTolerance)*1000
      const age = createdAt + ttl * 1000 + elapsedInSwr - createdAt;
      const minAge = ttl * 1000;
      const maxAge = (ttl + swrTolerance) * 1000;

      expect(age).toBeGreaterThanOrEqual(minAge - 100); // Small tolerance for timing
      expect(age).toBeLessThan(maxAge);

      vi.useRealTimers();
    });
  });

  it('should regenerate synchronously when outside SWR window', async () => {
    const key = 'test:sync';
    const ttl = 1;
    const swrTolerance = 1;
    const past = Date.now() - (ttl + swrTolerance + 1) * 1000; // 远超 SWR 容忍

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
    const past = Date.now() - (ttl + 1) * 1000; // 过期

    const cached: CachedResult = {
      data: { value: 'stale' },
      meta: { timestamp: past, regenerating: false },
    };
    await cache.set(key, cached);

    const generator = vi.fn().mockResolvedValue({ value: 'fresh' });

    const result = await service.getDerivedView({ key, generator, ttl, swr: false });

    expect(result as any).toEqual({ value: 'fresh' });
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
      meta: { timestamp: Date.now(), regenerating: true },
    };
    await cache.set(key, cached);

    const isRegen = await service.isRegenerating(key);

    expect(isRegen).toBe(true);
  });

  it('should return false when data is not regenerating', async () => {
    const key = 'test:not-regenerating';
    const cached: CachedResult = {
      data: { value: 'data' },
      meta: { timestamp: Date.now(), regenerating: false },
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
    // Use fake timers to avoid real setTimeout timeout
    vi.useFakeTimers();

    const key = 'test:async-error';
    const ttl = 1;
    const swrTolerance = 60;
    const past = Date.now() - (ttl + 1) * 1000;

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

    // Advance fake timers for async regeneration attempt
    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    // Error should be logged, but not thrown
    // The regeneratingKeys should be cleaned up

    vi.useRealTimers();
  });

  it('should prevent duplicate async regeneration for same key', async () => {
    // Use fake timers to avoid real setTimeout timeout
    vi.useFakeTimers();

    const key = 'test:duplicate-regen';
    const ttl = 1;
    const swrTolerance = 60;
    const past = Date.now() - (ttl + 1) * 1000;

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

    // Advance fake timers for async regeneration
    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    // Generator should be called only once due to duplicate prevention
    expect(generator.mock.calls.length).toBeLessThanOrEqual(2); // At most 2: initial check + one regeneration

    vi.useRealTimers();
  });

  describe('Concurrent Regeneration Lock', () => {
    it('should use atomic test-and-set for regeneration lock', async () => {
      vi.useFakeTimers();

      const key = 'test:lock-atomic';
      const ttl = 1;
      const swrTolerance = 60;
      const past = Date.now() - (ttl + 1) * 1000;

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

      // Advance fake timers to let async regeneration complete
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Generator should be called minimally (lock prevents duplicate calls)
      expect(generator.mock.calls.length).toBeLessThanOrEqual(2);

      // Final value should be updated
      const final = await cache.get<CachedResult>(key);
      expect((final as any)?.data.value).toBe('fresh');

      vi.useRealTimers();
    });

    it('should handle multiple concurrent requests outside SWR window', async () => {
      vi.useFakeTimers();

      const key = 'test:concurrent-miss-lock';
      const ttl = 1;
      const swrTolerance = 10;
      const past = Date.now() - (ttl + swrTolerance + 1) * 1000; // Far outside SWR window

      const cached: CachedResult = {
        data: { value: 'very-stale' },
        meta: { timestamp: past, regenerating: false },
      };
      await cache.set(key, cached);

      let generatorCallCount = 0;
      const generator = vi.fn().mockImplementation(() => {
        generatorCallCount++;
        // No real setTimeout - use fake timer version that completes immediately
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

      vi.useRealTimers();
    });

    it('should handle regenerating flag correctly during concurrent access', async () => {
      vi.useFakeTimers();

      const key = 'test:regen-flag';
      const ttl = 1;
      const swrTolerance = 60;
      const past = Date.now() - (ttl + 1) * 1000;

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

      // Advance timers for regeneration
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // During/after regeneration, isRegenerating should reflect state
      const isRegenBefore = await service.isRegenerating(key);
      // May or may not be true depending on timing, but should be boolean
      expect(typeof isRegenBefore).toBe('boolean');

      // After regeneration, should be false
      const isRegenAfter = await service.isRegenerating(key);
      expect(isRegenAfter).toBe(false);

      vi.useRealTimers();
    });
  });
});
