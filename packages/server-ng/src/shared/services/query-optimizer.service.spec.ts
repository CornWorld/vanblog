import { Logger } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { QueryOptimizerService } from './query-optimizer.service';

import type { Database } from '../../database/connection';

describe('QueryOptimizerService', () => {
  let service: QueryOptimizerService;
  let cache: { wrap: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    cache = {
      wrap: vi.fn(),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    service = new QueryOptimizerService(cache as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('withCache / clearCache', () => {
    it('should delegate to CacheService.wrap and return value', async () => {
      cache.wrap.mockResolvedValueOnce('cached');

      const res = await service.withCache('k', async () => await Promise.resolve('x'), 123);

      expect(cache.wrap).toHaveBeenCalledWith('k', expect.any(Function), 123);
      expect(res).toBe('cached');
    });

    it('should clear all cache when called with/without pattern', async () => {
      await service.clearCache();
      await service.clearCache('articles:*');
      expect(cache.clear).toHaveBeenCalledTimes(2);
    });
  });

  describe('batchCountArticlesByTags', () => {
    it('should return empty map when input is empty', async () => {
      const db = {} as unknown as Database;
      const res = await service.batchCountArticlesByTags(db, []);
      expect(res).toEqual({});
    });

    it('should return counts using db.all and fill missing with 0', async () => {
      const db = {
        all: vi.fn().mockResolvedValue([
          { tag_name: 't1', article_count: 3 },
          { tag_name: 't3', article_count: 1 },
        ]),
      } as unknown as Database;

      const res = await service.batchCountArticlesByTags(db, ['t1', 't2', 't3']);

      expect(db.all).toHaveBeenCalledWith(expect.any(Object));
      expect(res).toEqual({ t1: 3, t2: 0, t3: 1 });
    });

    it('should fallback to per-tag get() when db.all throws', async () => {
      const queue = [{ count: 2 }, undefined, { count: 5 }];
      const db = {
        all: vi.fn().mockRejectedValue(new Error('boom')),
        get: vi
          .fn()
          .mockImplementation(async (_q: unknown) => await Promise.resolve(queue.shift())),
      } as unknown as Database;

      const res = await service.batchCountArticlesByTags(db, ['a', 'b', 'c']);

      expect(db.all).toHaveBeenCalled();
      expect(db.get).toHaveBeenCalledTimes(3);
      expect(res).toEqual({ a: 2, b: 0, c: 5 });
    });
  });

  describe('batchCountArticlesByCategories', () => {
    it('should return empty map when input is empty', async () => {
      const db = {} as unknown as Database;
      const res = await service.batchCountArticlesByCategories(db, []);
      expect(res).toEqual({});
    });

    it('should return counts using db.all and fill missing with 0', async () => {
      const db = {
        all: vi.fn().mockResolvedValue([
          { category: 'c1', article_count: 4 },
          { category: 'c3', article_count: 7 },
        ]),
      } as unknown as Database;

      const res = await service.batchCountArticlesByCategories(db, ['c1', 'c2', 'c3']);

      expect(db.all).toHaveBeenCalledWith(expect.any(Object));
      expect(res).toEqual({ c1: 4, c2: 0, c3: 7 });
    });

    it('should return zeros when db.all throws', async () => {
      const db = {
        all: vi.fn().mockRejectedValue(new Error('x')),
      } as unknown as Database;

      const res = await service.batchCountArticlesByCategories(db, ['c1', 'c2']);
      expect(res).toEqual({ c1: 0, c2: 0 });
    });
  });

  describe('buildOptimizedSearchQuery', () => {
    it('should build conditions based on flags', () => {
      const conds1 = service.buildOptimizedSearchQuery('kw', true, false);
      const conds2 = service.buildOptimizedSearchQuery('kw', false, true);
      const conds3 = service.buildOptimizedSearchQuery('kw', true, true);

      expect(Array.isArray(conds1)).toBe(true);
      expect(conds1).toHaveLength(1);
      expect(conds2).toHaveLength(1);
      expect(conds3).toHaveLength(2);
    });

    it('should truncate long keyword for content search path', () => {
      const long = 'x'.repeat(120);
      const conds = service.buildOptimizedSearchQuery(long, false, true);
      expect(conds).toHaveLength(1);
      // drizzle SQL object opaque; at least ensure it was generated
      expect(typeof conds[0]).toBe('object');
    });
  });

  describe('performance monitoring and stats', () => {
    it('should log slow query and update stats', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined as any);

      // force duration 1200ms without sleeping
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2200);

      const result = await service.withPerformanceMonitoring(
        'q1',
        async () => await Promise.resolve(42),
        1000,
      );
      expect(result).toBe(42);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      const stats = service.getQueryStats();
      expect(stats.length).toBeGreaterThan(0);
      expect(stats[0].name).toBe('q1');
      expect(stats[0].count).toBe(1);
      expect(stats[0].avgTime).toBeGreaterThanOrEqual(1200 - 5); // allow tiny delta

      nowSpy.mockRestore();
    });

    it('should record failure and rethrow', async () => {
      const errorSpy = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation((_msg: unknown, _err: unknown) => undefined as any);
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValueOnce(10).mockReturnValueOnce(1015);

      await expect(
        service.withPerformanceMonitoring('qerr', async () => {
          await Promise.resolve();
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');

      const stats = service.getQueryStats();
      const s = stats.find((x) => x.name === 'qerr');
      expect(s).toBeDefined();
      if (!s) {
        throw new Error('Expected to find stats for qerr');
      }
      expect(s.count).toBe(1);

      nowSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should reset stats', async () => {
      vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(1);
      await service.withPerformanceMonitoring('q', async () => await Promise.resolve(1));
      expect(service.getQueryStats().length).toBeGreaterThan(0);
      service.resetQueryStats();
      expect(service.getQueryStats()).toEqual([]);
    });
  });

  describe('index suggestions', () => {
    it('should expose baseline suggestions and allow adding unique ones', () => {
      const base = service.getIndexSuggestions();
      expect(base.length).toBeGreaterThanOrEqual(1);
      expect(base.some((s) => s.table === 'articles')).toBe(true);

      const initial = base.length;
      const suggestion = {
        table: 'articles',
        columns: ['viewer'],
        reason: 'Optimize view count queries',
        estimatedImprovement: 'Low',
      };

      service.addIndexSuggestion({ ...suggestion });
      expect(service.getIndexSuggestions().length).toBe(initial + 1);

      // adding the same again should be ignored
      service.addIndexSuggestion({ ...suggestion });
      expect(service.getIndexSuggestions().length).toBe(initial + 1);
    });

    it('should analyze patterns from slow queries', async () => {
      // Make two slow queries: one article search and one category
      const nowSpy = vi
        .spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1700) // 700ms (over 500)
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(3400); // 1400ms (over 1000)

      await service.withPerformanceMonitoring(
        'article search list',
        async () => await Promise.resolve(1),
      );
      await service.withPerformanceMonitoring(
        'category list',
        async () => await Promise.resolve(1),
      );

      const dyn = service.analyzeQueryPatterns();
      expect(dyn.length).toBeGreaterThanOrEqual(1);
      expect(dyn.some((d) => d.table === 'articles')).toBe(true);

      nowSpy.mockRestore();
    });

    it('should generate optimization report', async () => {
      service.resetQueryStats();
      vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(2);
      await service.withPerformanceMonitoring('q1', async () => await Promise.resolve(1));
      vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(3);
      await service.withPerformanceMonitoring('q2', async () => await Promise.resolve(1));

      const report = service.generateOptimizationReport();
      expect(report.totalQueries).toBe(2);
      expect(Array.isArray(report.slowQueries)).toBe(true);
      expect(Array.isArray(report.indexSuggestions)).toBe(true);
      expect(Array.isArray(report.dynamicSuggestions)).toBe(true);
    });
  });
});
