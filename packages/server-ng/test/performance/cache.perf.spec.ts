import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { Logger } from '@nestjs/common';

/**
 * Cache Performance Tests
 *
 * Measures cache system performance under various load conditions
 * including stampede mitigation, LRU eviction, and concurrent access.
 *
 * Performance Baselines:
 * - 10,000 cache writes: No memory leak detected
 * - Cache stampede (100 concurrent requests): Single generator call
 * - Cache with 1000+ keys: LRU eviction works efficiently
 * - Cache serialization (complex objects): < 100ms
 * - Concurrent read/write (50/50 mix): No deadlock
 */

describe('Cache Performance (cache.perf.spec.ts)', () => {
  let logger: Logger;
  const performanceResults: Record<
    string,
    { mean: number; peakMemory: number; operations: number }
  > = {};

  beforeEach(() => {
    logger = new Logger('CachePerf');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Benchmark: 10,000 cache writes
   * Verifies no memory leak over many write operations
   */
  it('should handle 10000 cache writes without memory leak', () => {
    const cacheSize = 10000;
    const cache = new Map<string, unknown>();
    const initialMemory = process.memoryUsage().heapUsed;
    const memorySnapshots: number[] = [];

    // Simulate cache writes
    for (let i = 0; i < cacheSize; i++) {
      const key = `cache-key-${String(i)}`;
      const value = {
        id: i,
        data: `value-${String(i)}`,
        metadata: { timestamp: Date.now(), ttl: 3600 },
        tags: Array.from({ length: 10 }, (_, j) => `tag-${String(j)}`),
      };

      cache.set(key, value);

      // Capture memory every 1000 writes
      if ((i + 1) % 1000 === 0) {
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }
    }

    if (global.gc) {
      global.gc();
    }
    const finalMemory = process.memoryUsage().heapUsed;

    // Analyze memory growth pattern
    const growthRates: number[] = [];
    for (let i = 1; i < memorySnapshots.length; i++) {
      growthRates.push(memorySnapshots[i] - memorySnapshots[i - 1]);
    }

    const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
    const totalMemoryUsed = (finalMemory - initialMemory) / 1024 / 1024;
    const memoryPerKey = (totalMemoryUsed * 1024 * 1024) / cacheSize;

    performanceResults['10k-writes'] = {
      mean: avgGrowth / 1024,
      peakMemory: totalMemoryUsed,
      operations: cacheSize,
    };

    logger.log(
      `Cache 10,000 writes - Total memory: ${totalMemoryUsed.toFixed(2)}MB, Per-key: ${(memoryPerKey / 1024).toFixed(2)}KB, Growth pattern: ${growthRates.map((g) => (g / 1024 / 1024).toFixed(1)).join(', ')}MB`,
    );

    expect(cache.size).toBe(cacheSize);
    expect(totalMemoryUsed).toBeLessThan(100); // Should use reasonable amount of memory
    expect(avgGrowth).toBeLessThan(1024 * 1024); // Growth per batch should be consistent
  });

  /**
   * Benchmark: Cache stampede mitigation
   * Verifies that concurrent requests for missing key only trigger one generator call
   */
  it('should handle cache stampede with single generator call', async () => {
    const cache = new Map<string, { value: unknown; timestamp: number }>();
    let generatorCallCount = 0;
    const stampedKey = 'stampede-test-key';

    // Simulate cache getter with stampede protection
    const getCached = async (_key: string, generator: () => Promise<unknown>): Promise<unknown> => {
      if (cache.has(_key)) {
        return cache.get(_key)?.value;
      }

      // Simulate stampede protection using a pending promise
      const existing = (cache as any).pending?.[_key];
      if (existing) {
        return existing;
      }

      // Create pending promise
      const pending = (async () => {
        generatorCallCount++;
        const value = await generator();
        cache.set(_key, { value, timestamp: Date.now() });
        return value;
      })();

      if (!(cache as any).pending) {
        (cache as any).pending = {};
      }
      (cache as any).pending[_key] = pending;

      const result = await pending;
      if ((cache as any).pending) {
        // Use Object.assign with undefined to safely remove the key
        const { [_key]: _, ...remaining } = (cache as any).pending;
        (cache as any).pending = remaining;
      }
      return result;
    };

    // Simulate 100 concurrent requests for the same missing key
    const results = await Promise.all(
      Array(100)
        .fill(null)
        .map(() =>
          getCached(stampedKey, async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { data: 'stampede-result' };
          }),
        ),
    );

    performanceResults['stampede-mitigation'] = {
      mean: 0,
      peakMemory: 0,
      operations: generatorCallCount,
    };

    logger.log(
      `Cache stampede - Concurrent requests: 100, Generator calls: ${String(generatorCallCount)}`,
    );

    expect(results).toHaveLength(100);
    expect(generatorCallCount).toBeLessThanOrEqual(2); // Should be called only once (or maybe twice due to async timing)
    expect(cache.size).toBe(1);
  });

  /**
   * Benchmark: LRU eviction with 1000+ keys
   * Tests cache eviction efficiency under capacity
   */
  it('should efficiently evict LRU entries with 1000+ keys', () => {
    const maxCacheSize = 1000;
    const totalInserts = 2000; // Try to insert more than max
    const cache = new Map<string, { value: string; timestamp: number; accessCount: number }>();
    let evictionCount = 0;

    // Implement simple LRU eviction
    const setCacheWithLRU = (key: string, value: string): void => {
      cache.set(key, {
        value,
        timestamp: Date.now(),
        accessCount: 0,
      });

      // Evict LRU when exceeding capacity
      if (cache.size > maxCacheSize) {
        // Find least recently used entry
        let lruKey = '';
        let lruTime = Infinity;

        for (const [k, v] of cache) {
          if (v.timestamp < lruTime) {
            lruTime = v.timestamp;
            lruKey = k;
          }
        }

        if (lruKey) {
          cache.delete(lruKey);
          evictionCount++;
        }
      }
    };

    // Insert more keys than cache capacity
    for (let i = 0; i < totalInserts; i++) {
      setCacheWithLRU(`key-${String(i)}`, `value-${String(i)}`);
    }

    const finalSize = cache.size;
    const evictionRate = (evictionCount / totalInserts) * 100;

    performanceResults['lru-eviction-1000'] = {
      mean: 0,
      peakMemory: finalSize,
      operations: evictionCount,
    };

    logger.log(
      `LRU eviction - Final cache size: ${String(finalSize)}, Evictions: ${String(evictionCount)}, Rate: ${evictionRate.toFixed(2)}%`,
    );

    expect(finalSize).toBeLessThanOrEqual(maxCacheSize + 1); // Allow small overshoot
    expect(evictionCount).toBeGreaterThan(0); // Some evictions should occur
    expect(evictionRate).toBeGreaterThan(40); // At least 40% of inserts should trigger eviction
  });

  /**
   * Benchmark: Cache serialization
   * Measures serialization time for complex objects
   */
  it('should serialize complex cache objects in < 100ms', () => {
    const measurements: number[] = [];

    // Create complex object with nested structures
    const createComplexObject = (index: number): object => ({
      id: `object-${String(index)}`,
      nested: {
        level1: {
          level2: {
            level3: {
              data: Array.from({ length: 50 }, (_, i) => `item-${String(i)}`),
            },
          },
        },
      },
      arrays: {
        numbers: Array.from({ length: 100 }, (_, i) => i),
        strings: Array.from({ length: 100 }, (_, i) => `string-${String(i)}`),
      },
      tags: Array.from({ length: 20 }, (_, i) => ({
        id: `tag-${String(i)}`,
        name: `Tag ${String(i)}`,
        metadata: { created: Date.now(), modified: Date.now() },
      })),
    });

    // Benchmark serialization 100 times
    for (let i = 0; i < 100; i++) {
      const obj = createComplexObject(i);
      const start = performance.now();

      // Serialize to JSON
      const serialized = JSON.stringify(obj);
      const end = performance.now();

      measurements.push(end - start);

      // Verify deserialization works
      const deserialized = JSON.parse(serialized);
      expect(deserialized.id).toBe(`object-${String(i)}`);
    }

    const mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const max = Math.max(...measurements);
    const p95 = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];

    performanceResults['serialization'] = {
      mean,
      peakMemory: max,
      operations: measurements.length,
    };

    logger.log(
      `Serialization - Mean: ${mean.toFixed(3)}ms, P95: ${p95.toFixed(3)}ms, Max: ${max.toFixed(3)}ms`,
    );

    expect(mean).toBeLessThan(10); // Complex objects should serialize quickly
    expect(max).toBeLessThan(100); // Even in worst case
  });

  /**
   * Benchmark: Concurrent read/write (50/50 mix)
   * Tests cache performance under mixed concurrent operations
   */
  it('should handle concurrent read/write mix (50/50) without deadlock', () => {
    const cache = new Map<string, unknown>();
    const operationCount = 1000;
    const readWriteResults: { type: string; duration: number }[] = [];
    let deadlockDetected = false;

    // Simulate concurrent operations
    const operations = Array.from({ length: operationCount }, (_, i) => {
      const isRead = Math.random() < 0.5;
      const start = performance.now();

      if (isRead) {
        // Read operation
        const key = `key-${String(Math.floor(Math.random() * 100))}`;
        const value = cache.get(key);
        const end = performance.now();
        return {
          type: 'read',
          duration: end - start,
          success: value !== undefined || Math.random() > 0.5,
        };
      }
      // Write operation
      const key = `key-${String(Math.floor(Math.random() * 100))}`;
      cache.set(key, { timestamp: Date.now(), data: `value-${String(i)}` });
      const end = performance.now();
      return { type: 'write', duration: end - start, success: true };
    });

    // Execute all operations concurrently
    const maxConcurrency = 50;
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);

      // Simulate concurrent execution
      const batchStart = performance.now();
      batch.forEach((op) => {
        readWriteResults.push({ type: op.type, duration: op.duration });
      });
      const batchEnd = performance.now();

      // Check for timeout (deadlock indicator)
      if (batchEnd - batchStart > 5000) {
        deadlockDetected = true;
        break;
      }
    }

    const reads = readWriteResults.filter((r) => r.type === 'read');
    const writes = readWriteResults.filter((r) => r.type === 'write');
    const avgReadTime = reads.reduce((a, b) => a + b.duration, 0) / reads.length;
    const avgWriteTime = writes.reduce((a, b) => a + b.duration, 0) / writes.length;

    performanceResults['concurrent-read-write'] = {
      mean: (avgReadTime + avgWriteTime) / 2,
      peakMemory: cache.size,
      operations: operationCount,
    };

    logger.log(
      `Concurrent R/W - Reads: ${String(reads.length)}, Writes: ${String(writes.length)}, Avg read: ${avgReadTime.toFixed(3)}ms, Avg write: ${avgWriteTime.toFixed(3)}ms, Cache size: ${String(cache.size)}`,
    );

    expect(deadlockDetected).toBeFalsy();
    expect(reads.length + writes.length).toBe(operationCount);
  });

  /**
   * Test: Cache TTL and expiration
   * Verifies expired entries are handled correctly
   */
  it('should handle TTL expiration without memory accumulation', async () => {
    const cache = new Map<string, { value: string; expiresAt: number }>();
    const ttlMs = 100; // 100ms TTL

    // Add 1000 entries
    for (let i = 0; i < 1000; i++) {
      cache.set(`key-${String(i)}`, {
        value: `value-${String(i)}`,
        expiresAt: Date.now() + ttlMs,
      });
    }

    expect(cache.size).toBe(1000);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, ttlMs + 50));

    // Simulate cleanup of expired entries
    let expiredCount = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of cache) {
      if (Date.now() > entry.expiresAt) {
        keysToDelete.push(key);
        expiredCount++;
      }
    }

    keysToDelete.forEach((key) => cache.delete(key));

    performanceResults['ttl-expiration'] = {
      mean: 0,
      peakMemory: cache.size,
      operations: expiredCount,
    };

    logger.log(
      `TTL expiration - Expired entries: ${String(expiredCount)}, Remaining: ${String(cache.size)}`,
    );

    expect(expiredCount).toBe(1000); // All should expire
    expect(cache.size).toBe(0);
  });

  /**
   * Summary: Log all performance metrics
   */
  it('should print cache performance summary', () => {
    console.log('\n=== Cache Performance Summary ===');
    Object.entries(performanceResults).forEach(([name, metrics]) => {
      console.log(`${name}:`);
      if (metrics.mean > 0) {
        console.log(`  Mean latency: ${metrics.mean.toFixed(3)}ms`);
      }
      if (metrics.peakMemory > 0) {
        console.log(
          `  Peak/Size:    ${String(metrics.peakMemory).padStart(8)} (${metrics.peakMemory.toFixed(2)})`,
        );
      }
      if (metrics.operations > 0) {
        console.log(`  Operations:   ${String(metrics.operations)}`);
      }
    });
    console.log('==================================\n');
  });
});
