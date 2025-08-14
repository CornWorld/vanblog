import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, afterEach, afterAll, describe, it, expect, vi } from 'vitest';

import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let module: TestingModule;
  let mockCache: any;

  beforeEach(async () => {
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      clear: vi.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCache,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('get', () => {
    it('should return cached value', async () => {
      const key = 'test-key';
      const value = 'test-value';
      mockCache.get.mockResolvedValue(value);

      const result = await service.get(key);

      expect(result).toBe(value);
      expect(mockCache.get).toHaveBeenCalledWith(key);
    });

    it('should return null for non-existent key', async () => {
      const key = 'non-existent';
      mockCache.get.mockResolvedValue(undefined);

      const result = await service.get(key);

      expect(result).toBeNull();
      expect(mockCache.get).toHaveBeenCalledWith(key);
    });

    it('should handle different data types', async () => {
      const testCases = [
        { key: 'string-key', value: 'string-value' },
        { key: 'number-key', value: 42 },
        { key: 'object-key', value: { name: 'test', count: 1 } },
        { key: 'array-key', value: [1, 2, 3] },
        { key: 'boolean-key', value: true },
      ];

      for (const testCase of testCases) {
        mockCache.get.mockResolvedValue(testCase.value);
        const result = await service.get(testCase.key);
        expect(result).toEqual(testCase.value);
      }
    });
  });

  describe('set', () => {
    it('should set cache with default TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await service.set(key, value);

      expect(mockCache.set).toHaveBeenCalledWith(key, value, 300000); // 300 seconds * 1000
    });

    it('should set cache with custom TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const ttl = 600; // 10 minutes

      await service.set(key, value, ttl);

      expect(mockCache.set).toHaveBeenCalledWith(key, value, 600000); // 600 seconds * 1000
    });

    it('should handle different data types', async () => {
      const testCases = [
        { key: 'string-key', value: 'string-value' },
        { key: 'number-key', value: 42 },
        { key: 'object-key', value: { name: 'test', count: 1 } },
        { key: 'array-key', value: [1, 2, 3] },
        { key: 'boolean-key', value: true },
      ];

      for (const testCase of testCases) {
        await service.set(testCase.key, testCase.value);
        expect(mockCache.set).toHaveBeenCalledWith(testCase.key, testCase.value, 300000);
      }
    });
  });

  describe('del', () => {
    it('should delete existing key', async () => {
      const key = 'test-key';

      await service.del(key);

      expect(mockCache.del).toHaveBeenCalledWith(key);
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      await service.clear();

      expect(mockCache.clear).toHaveBeenCalled();
    });
  });

  describe('wrap', () => {
    it('should return cached value if exists', async () => {
      const key = 'test-key';
      const cachedValue = 'cached-value';
      const factory = vi.fn().mockResolvedValue('new-value');
      mockCache.get.mockResolvedValue(cachedValue);

      const result = await service.wrap(key, factory);

      expect(result).toBe(cachedValue);
      expect(factory).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const key = 'test-key';
      const factoryValue = 'factory-value';
      const factory = vi.fn().mockResolvedValue(factoryValue);
      mockCache.get.mockResolvedValue(undefined);

      const result = await service.wrap(key, factory);

      expect(result).toBe(factoryValue);
      expect(factory).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(key, factoryValue, 300000);
    });

    it('should use custom TTL when caching factory result', async () => {
      const key = 'test-key';
      const factoryValue = 'factory-value';
      const factory = vi.fn().mockResolvedValue(factoryValue);
      const ttl = 600;
      mockCache.get.mockResolvedValue(undefined);

      const result = await service.wrap(key, factory, ttl);

      expect(result).toBe(factoryValue);
      expect(factory).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(key, factoryValue, 600000);
    });
  });

  describe('key', () => {
    it('should generate cache key from prefix and parts', () => {
      const result = CacheService.key('user', 123, 'profile');
      expect(result).toBe('user:123:profile');
    });

    it('should handle single prefix', () => {
      const result = CacheService.key('simple');
      expect(result).toBe('simple');
    });

    it('should handle mixed types', () => {
      const result = CacheService.key('mixed', 'string', 42, 'end');
      expect(result).toBe('mixed:string:42:end');
    });
  });
});
