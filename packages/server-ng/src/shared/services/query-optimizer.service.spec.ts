import { describe, it, expect, beforeEach, vi } from 'vitest';

import { QueryOptimizerService } from './query-optimizer.service';

import type { Database } from '../../database';

describe('QueryOptimizerService', () => {
  let service: QueryOptimizerService;
  let mockDb: Database;

  beforeEach(() => {
    // Mock database
    mockDb = {
      all: vi.fn(),
      get: vi.fn(),
      run: vi.fn(),
    } as any;

    service = new QueryOptimizerService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('batchCountArticlesByTags', () => {
    it('should return empty object for empty tag names', async () => {
      const result = await service.batchCountArticlesByTags(mockDb, []);
      expect(result).toEqual({});
    });

    it('should return tag counts', async () => {
      const mockResults = [
        { tag_name: 'javascript', article_count: 5 },
        { tag_name: 'typescript', article_count: 3 },
      ];
      vi.mocked(mockDb.all).mockResolvedValue(mockResults);

      const result = await service.batchCountArticlesByTags(mockDb, [
        'javascript',
        'typescript',
        'python',
      ]);

      expect(result).toEqual({
        javascript: 5,
        typescript: 3,
        python: 0, // 初始化为0
      });
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(mockDb.all).mockRejectedValue(new Error('Database error'));

      const result = await service.batchCountArticlesByTags(mockDb, ['javascript']);
      expect(result).toEqual({});
    });
  });

  describe('buildOptimizedSearchQuery', () => {
    it('should return empty array when no search options are enabled', () => {
      const result = service.buildOptimizedSearchQuery('test', false, false);
      expect(result).toEqual([]);
    });

    it('should build search conditions for title and content', () => {
      const result = service.buildOptimizedSearchQuery('test', true, true);
      expect(result).toHaveLength(1); // Should return one OR condition
    });

    it('should build search condition for title only', () => {
      const result = service.buildOptimizedSearchQuery('test', true, false);
      expect(result).toHaveLength(1);
    });

    it('should build search condition for content only', () => {
      const result = service.buildOptimizedSearchQuery('test', false, true);
      expect(result).toHaveLength(1);
    });
  });

  describe('withPerformanceMonitoring', () => {
    it('should execute query and return result', async () => {
      const mockQueryFn = vi.fn().mockResolvedValue('test result');

      const result = await service.withPerformanceMonitoring('test-query', mockQueryFn);

      expect(result).toBe('test result');
      expect(mockQueryFn).toHaveBeenCalledOnce();
    });

    it('should log slow queries', async () => {
      const mockQueryFn = vi.fn().mockImplementation(
        async () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve('result');
            }, 1100),
          ),
      );

      const loggerSpy = vi.spyOn(service['logger'], 'warn');

      await service.withPerformanceMonitoring('slow-query', mockQueryFn, 1000);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected: slow-query took'),
      );
    });

    it('should handle query errors', async () => {
      const mockQueryFn = vi.fn().mockRejectedValue(new Error('Query failed'));
      const loggerSpy = vi.spyOn(service['logger'], 'error');

      await expect(service.withPerformanceMonitoring('failing-query', mockQueryFn)).rejects.toThrow(
        'Query failed',
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Query failed: failing-query after'),
        expect.any(Error),
      );
    });
  });
});
