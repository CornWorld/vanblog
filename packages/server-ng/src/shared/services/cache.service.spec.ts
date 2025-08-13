import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, afterEach, afterAll, describe, it, expect, vi } from 'vitest';

import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: Logger,
          useValue: {
            log: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    service.clear();
  });

  afterAll(() => {
    service.onModuleDestroy();
  });

  describe('set and get', () => {
    it('should set and get a value', () => {
      const key = 'test-key';
      const value = 'test-value';

      service.set(key, value);
      const result = service.get(key);

      expect(result).toBe(value);
    });

    it('should return null for non-existent key', () => {
      const result = service.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle different data types', () => {
      const testCases = [
        { key: 'string', value: 'test' },
        { key: 'number', value: 42 },
        { key: 'boolean', value: true },
        { key: 'object', value: { name: 'test', age: 25 } },
        { key: 'array', value: [1, 2, 3] },
        { key: 'null', value: null },
      ];

      testCases.forEach(({ key, value }) => {
        service.set(key, value);
        expect(service.get(key)).toEqual(value);
      });
    });

    it('should handle TTL expiration', async () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      const ttl = 50; // 50ms

      service.set(key, value, ttl);
      expect(service.get(key)).toBe(value);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(service.get(key)).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing key', () => {
      const key = 'test-key';
      const value = 'test-value';

      service.set(key, value);
      const deleted = service.delete(key);
      const result = service.get(key);

      expect(deleted).toBe(true);
      expect(result).toBeNull();
    });

    it('should return false for non-existent key', () => {
      const deleted = service.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      const key = 'test-key';
      const value = 'test-value';

      service.set(key, value);
      expect(service.has(key)).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(service.has('non-existent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      const ttl = 50; // 50ms

      service.set(key, value, ttl);
      expect(service.has(key)).toBe(true);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(service.has(key)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');
      service.set('key3', 'value3');

      expect(service.size()).toBe(3);

      service.clear();

      expect(service.size()).toBe(0);
      expect(service.get('key1')).toBeNull();
      expect(service.get('key2')).toBeNull();
      expect(service.get('key3')).toBeNull();
    });

    it('should clear empty cache without error', () => {
      expect(service.size()).toBe(0);
      service.clear();
      expect(service.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return correct cache size', () => {
      expect(service.size()).toBe(0);

      service.set('key1', 'value1');
      expect(service.size()).toBe(1);

      service.set('key2', 'value2');
      expect(service.size()).toBe(2);

      service.delete('key1');
      expect(service.size()).toBe(1);

      service.clear();
      expect(service.size()).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should track cache statistics', () => {
      // Initial stats
      let stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.hitRate).toBe(0);

      // Set operation
      service.set('key1', 'value1');
      stats = service.getStats();
      expect(stats.sets).toBe(1);
      expect(stats.totalSize).toBe(1);

      // Hit operation
      service.get('key1');
      stats = service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.hitRate).toBe(100);

      // Miss operation
      service.get('key2');
      stats = service.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);

      // Delete operation
      service.delete('key1');
      stats = service.getStats();
      expect(stats.deletes).toBe(1);
      expect(stats.totalSize).toBe(0);
    });

    it('should calculate hit rate correctly', () => {
      service.set('key1', 'value1');

      // 1 hit, 0 misses = 100%
      service.get('key1');
      expect(service.getStats().hitRate).toBe(100);

      // 1 hit, 1 miss = 50%
      service.get('key2');
      expect(service.getStats().hitRate).toBe(50);

      // 2 hits, 1 miss = 66.67%
      service.get('key1');
      expect(service.getStats().hitRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', () => {
      // Generate some stats
      service.set('key1', 'value1');
      service.get('key1'); // hit
      service.get('key2'); // miss
      service.delete('key1');

      let stats = service.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.sets).toBeGreaterThan(0);
      expect(stats.deletes).toBeGreaterThan(0);

      // Reset stats
      service.resetStats();
      stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('getOrSet', () => {
    it('should return existing value', async () => {
      const key = 'existing-key';
      const existingValue = 'existing-value';
      const factory = vi.fn().mockResolvedValue('new-value');

      service.set(key, existingValue);
      const result = await service.getOrSet(key, factory);

      expect(result).toBe(existingValue);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory for non-existent key', async () => {
      const key = 'new-key';
      const factoryValue = 'factory-value';
      const factory = vi.fn().mockResolvedValue(factoryValue);

      const result = await service.getOrSet(key, factory);

      expect(result).toBe(factoryValue);
      expect(factory).toHaveBeenCalledWith();
      expect(service.get(key)).toBe(factoryValue);
    });

    it('should use custom TTL when setting new value', async () => {
      const key = 'ttl-key';
      const factoryValue = 'factory-value';
      const factory = vi.fn().mockResolvedValue(factoryValue);
      const ttl = 100;

      const result = await service.getOrSet(key, factory, ttl);

      expect(result).toBe(factoryValue);
      expect(service.get(key)).toBe(factoryValue);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(service.get(key)).toBeNull();
    });
  });

  describe('mget', () => {
    it('should get multiple values', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');
      service.set('key3', 'value3');

      const result = service.mget<string>(['key1', 'key2', 'key3']);

      expect(result.size).toBe(3);
      expect(result.get('key1')).toBe('value1');
      expect(result.get('key2')).toBe('value2');
      expect(result.get('key3')).toBe('value3');
    });

    it('should handle non-existent keys', () => {
      service.set('key1', 'value1');

      const result = service.mget<string>(['key1', 'key2', 'key3']);

      expect(result.size).toBe(1);
      expect(result.get('key1')).toBe('value1');
      expect(result.has('key2')).toBe(false);
      expect(result.has('key3')).toBe(false);
    });

    it('should return empty map for all non-existent keys', () => {
      const result = service.mget<string>(['key1', 'key2']);
      expect(result.size).toBe(0);
    });

    it('should handle empty keys array', () => {
      const result = service.mget<string>([]);
      expect(result.size).toBe(0);
    });
  });

  describe('mset', () => {
    it('should set multiple values', () => {
      const entries = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3'],
      ]);

      service.mset(entries);

      expect(service.get('key1')).toBe('value1');
      expect(service.get('key2')).toBe('value2');
      expect(service.get('key3')).toBe('value3');
      expect(service.size()).toBe(3);
    });

    it('should set multiple values with custom TTL', () => {
      const entries = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);
      const ttl = 1000;

      service.mset(entries, ttl);

      expect(service.get('key1')).toBe('value1');
      expect(service.get('key2')).toBe('value2');
    });

    it('should handle empty entries map', () => {
      const entries = new Map<string, string>();
      service.mset(entries);
      expect(service.size()).toBe(0);
    });
  });

  describe('keys', () => {
    it('should return all cache keys', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');
      service.set('key3', 'value3');

      const keys = service.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return empty array for empty cache', () => {
      const keys = service.keys();
      expect(keys).toHaveLength(0);
    });
  });

  describe('getDebugInfo', () => {
    it('should return debug information', () => {
      service.set('key1', 'value1');
      service.set('key2', { name: 'test' });

      const debugInfo = service.getDebugInfo();

      expect(debugInfo.stats.totalSize).toBe(2);
      expect(debugInfo.config).toBeDefined();
      expect(debugInfo.entries).toHaveLength(2);
      expect(debugInfo.entries[0]).toHaveProperty('key');
      expect(debugInfo.entries[0]).toHaveProperty('size');
      expect(debugInfo.entries[0]).toHaveProperty('ttl');
      expect(debugInfo.entries[0]).toHaveProperty('age');
      expect(debugInfo.entries[0]).toHaveProperty('accessCount');
      expect(debugInfo.entries[0]).toHaveProperty('timeSinceLastAccess');
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used item when cache is full', async () => {
      // Mock the config to have a smaller max size for testing
      const originalConfig = (service as any).config;
      (service as any).config = { ...originalConfig, maxSize: 2 };

      service.set('key1', 'value1');
      // Add small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 2));
      service.set('key2', 'value2');

      // Add delay before accessing key1 to ensure different lastAccessed times
      await new Promise((resolve) => setTimeout(resolve, 2));
      // Access key1 to make it more recently used
      service.get('key1');

      // Add delay before setting key3
      await new Promise((resolve) => setTimeout(resolve, 2));
      // This should evict key2 (least recently used)
      service.set('key3', 'value3');

      expect(service.has('key1')).toBe(true);
      expect(service.has('key2')).toBe(false);
      expect(service.has('key3')).toBe(true);
      expect(service.size()).toBe(2);

      // Restore original config
      (service as any).config = originalConfig;
    });

    it('should track eviction stats', async () => {
      const originalConfig = (service as any).config;
      (service as any).config = { ...originalConfig, maxSize: 1 };

      // Reset stats before test
      service.resetStats();

      service.set('key1', 'value1');
      await new Promise((resolve) => setTimeout(resolve, 2));
      service.set('key2', 'value2'); // This should evict key1

      const stats = service.getStats();
      expect(stats.evictions).toBe(1);

      // Restore original config
      (service as any).config = originalConfig;
    });
  });

  describe('cleanup timer', () => {
    it('should clean up expired entries periodically', async () => {
      const originalConfig = (service as any).config;
      (service as any).config = { ...originalConfig, cleanupInterval: 30 }; // 30ms

      // Stop existing cleanup timer and start new one with shorter interval
      service.onModuleDestroy();
      (service as any).startCleanupTimer();

      service.set('key1', 'value1', 20); // 20ms TTL
      service.set('key2', 'value2', 1000); // 1000ms TTL

      expect(service.size()).toBe(2);

      // Wait for key1 to expire and cleanup to run
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(service.size()).toBe(1);
      expect(service.has('key1')).toBe(false);
      expect(service.has('key2')).toBe(true);

      // Restore original config
      (service as any).config = originalConfig;
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear cache and cleanup timer on destroy', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');

      expect(service.size()).toBe(2);

      service.onModuleDestroy();

      expect(service.size()).toBe(0);
    });
  });

  describe('access count tracking', () => {
    it('should track access count for entries', () => {
      service.set('key1', 'value1');

      // Initial access count should be 0
      const debugInfo1 = service.getDebugInfo();
      expect(debugInfo1.entries[0].accessCount).toBe(0);

      // Access the key
      service.get('key1');
      const debugInfo2 = service.getDebugInfo();
      expect(debugInfo2.entries[0].accessCount).toBe(1);

      // Access again
      service.get('key1');
      const debugInfo3 = service.getDebugInfo();
      expect(debugInfo3.entries[0].accessCount).toBe(2);
    });
  });
});
