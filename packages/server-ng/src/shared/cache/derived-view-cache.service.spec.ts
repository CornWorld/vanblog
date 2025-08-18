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
    expect(result).toEqual({ value: 42 });

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

    expect(result).toEqual({ value: 'fresh' });
    expect(generator).not.toHaveBeenCalled();
  });

  it('should return stale data and trigger async regeneration under SWR window', async () => {
    const key = 'test:swr';
    const ttl = 1;
    const swrTolerance = 60;
    const past = Date.now() - (ttl + 1) * 1000; // 刚过期

    const cached: CachedResult = {
      data: { value: 'stale' },
      meta: { timestamp: past, regenerating: false },
    };
    await cache.set(key, cached);

    const generator = vi.fn().mockResolvedValue({ value: 'fresh' });

    const result = await service.getDerivedView({ key, generator, ttl, swr: true, swrTolerance });

    // 立即返回旧数据
    expect(result).toEqual({ value: 'stale' });

    // 等待异步再生成完成
    await new Promise((resolve) => setTimeout(resolve, 50));

    const updated = (await cache.get<CachedResult>(key)) as CachedResult;
    expect(updated.data).toEqual({ value: 'fresh' });
    expect(updated.meta.regenerating).toBe(false);
    expect(typeof updated.meta.timestamp).toBe('number');
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

    expect(result).toEqual({ value: 'new-sync' });

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

    expect(result).toEqual({ value: 'fresh' });
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
});
