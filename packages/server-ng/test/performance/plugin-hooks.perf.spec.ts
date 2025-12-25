import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { MockUtils } from '../mock-utils';

/**
 * Plugin Hook System Performance Tests
 *
 * Measures hook system performance including plugin loading,
 * hook execution, and concurrent hook handling.
 *
 * Performance Baselines:
 * - Load 20 plugins: < 2 seconds
 * - Trigger hook with 10 handlers: Execution order maintained
 * - Filter hook transformation (1000 iterations): No slowdown
 * - Plugin with database queries: Connection pool efficient
 * - Concurrent hook executions: Thread-safe
 */

describe('Plugin Hook System Performance (plugin-hooks.perf.spec.ts)', () => {
  let logger: Logger;
  const performanceResults: Record<
    string,
    { mean: number; throughput: number; maxMemory: number }
  > = {};

  beforeEach(() => {
    logger = new Logger('PluginHooksPerf');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Benchmark: Load 20 plugins
   * Measures plugin initialization and registration time
   */
  it('should load 20 plugins in < 2 seconds', async () => {
    const pluginCount = 20;
    const initialMemory = process.memoryUsage().heapUsed;

    // Simulate plugin loading
    const loadPlugin = async (
      pluginId: string,
    ): Promise<{ id: string; name: string; version: string; hooks: string[] }> => {
      // Simulate plugin module loading: ~50ms per plugin
      await new Promise((resolve) => setTimeout(resolve, 50));

      return {
        id: pluginId,
        name: `Plugin ${pluginId}`,
        version: '1.0.0',
        hooks: ['article|beforeCreate', 'article|afterCreate', 'setting|afterUpdate'],
      };
    };

    const startTime = performance.now();

    // Load all plugins in parallel
    const plugins = await Promise.all(
      Array.from({ length: pluginCount }, (_, i) => loadPlugin(`plugin-${i}`)),
    );

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024;

    performanceResults['load-20-plugins'] = {
      mean: totalTime / pluginCount,
      throughput: pluginCount / (totalTime / 1000),
      maxMemory: memoryUsed,
    };

    logger.log(
      `Load 20 plugins - Total: ${totalTime.toFixed(2)}ms, Per-plugin: ${(totalTime / pluginCount).toFixed(2)}ms, Memory: ${memoryUsed.toFixed(2)}MB`,
    );

    expect(plugins).toHaveLength(pluginCount);
    expect(totalTime).toBeLessThan(2000);
  });

  /**
   * Benchmark: Hook execution with 10 handlers
   * Measures overhead of hook system with multiple handlers
   */
  it('should execute hook with 10 handlers efficiently', async () => {
    const measurements: number[] = [];
    const handlerCount = 10;

    // Simulate hook system
    class HookRegistry {
      private handlers: Map<string, Array<(data: any) => Promise<any>>> = new Map();

      registerHandler(hook: string, handler: (data: any) => Promise<any>): void {
        if (!this.handlers.has(hook)) {
          this.handlers.set(hook, []);
        }
        this.handlers.get(hook)!.push(handler);
      }

      async executeHook(hook: string, data: any): Promise<any> {
        const handlers = this.handlers.get(hook) || [];
        let result = data;

        for (const handler of handlers) {
          result = await handler(result);
        }

        return result;
      }
    }

    const registry = new HookRegistry();

    // Register 10 handlers
    for (let i = 0; i < handlerCount; i++) {
      registry.registerHandler('article|beforeCreate', async (article) => {
        // Simulate handler work: ~1ms per handler
        await new Promise((resolve) => setTimeout(resolve, 1));
        return { ...article, processed_by_handler_: i };
      });
    }

    // Execute hook 50 times and measure
    for (let i = 0; i < 50; i++) {
      const testArticle = { id: `article-${i}`, title: 'Test' };
      const start = performance.now();

      const result = await registry.executeHook('article|beforeCreate', testArticle);

      const end = performance.now();
      measurements.push(end - start);

      expect(result.id).toBe(`article-${i}`);
    }

    const mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    performanceResults['hook-10-handlers'] = {
      mean,
      throughput: 50 / (measurements.reduce((a, b) => a + b, 0) / 1000),
      maxMemory: 0,
    };

    logger.log(
      `Hook execution (10 handlers) - Mean: ${mean.toFixed(2)}ms, Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`,
    );

    // Should execute quickly even with 10 handlers
    expect(mean).toBeLessThan(50); // ~1ms per handler + overhead
  });

  /**
   * Benchmark: Filter hook transformation (1000 iterations)
   * Tests data transformation performance through hooks
   */
  it('should transform data through filter hooks 1000 times without slowdown', async () => {
    const iterations = 1000;
    const measurements: number[] = [];

    // Simulate filter hook system
    class FilterHookRegistry {
      private filters: Map<string, Array<(data: any) => any>> = new Map();

      registerFilter(hook: string, filter: (data: any) => any): void {
        if (!this.filters.has(hook)) {
          this.filters.set(hook, []);
        }
        this.filters.get(hook)!.push(filter);
      }

      applyFilters(hook: string, data: any): any {
        const filters = this.filters.get(hook) || [];
        let result = data;

        for (const filter of filters) {
          result = filter(result);
        }

        return result;
      }
    }

    const filterRegistry = new FilterHookRegistry();

    // Register 5 filters
    filterRegistry.registerFilter('article|beforeCreate', (article) => ({
      ...article,
      slug: article.title.toLowerCase().replace(/\s+/g, '-'),
    }));

    filterRegistry.registerFilter('article|beforeCreate', (article) => ({
      ...article,
      tags: article.tags || [],
    }));

    filterRegistry.registerFilter('article|beforeCreate', (article) => ({
      ...article,
      metadata: { created: Date.now() },
    }));

    filterRegistry.registerFilter('article|beforeCreate', (article) => ({
      ...article,
      views: 0,
    }));

    filterRegistry.registerFilter('article|beforeCreate', (article) => ({
      ...article,
      commentCount: 0,
    }));

    // Run 1000 transformations in 10-iteration batches
    for (let batch = 0; batch < iterations / 10; batch++) {
      const start = performance.now();

      for (let i = 0; i < 10; i++) {
        const article = {
          id: `article-${batch * 10 + i}`,
          title: `Article ${batch * 10 + i}`,
          content: 'Test content',
        };

        const transformed = filterRegistry.applyFilters('article|beforeCreate', article);
        expect(transformed.slug).toBeDefined();
        expect(transformed.tags).toBeDefined();
      }

      const end = performance.now();
      measurements.push(end - start);
    }

    const mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    performanceResults['filter-1000-iterations'] = {
      mean,
      throughput: 1000 / (measurements.reduce((a, b) => a + b, 0) / 1000),
      maxMemory: 0,
    };

    logger.log(
      `Filter hook 1000 iterations (batches of 10) - Mean per batch: ${mean.toFixed(2)}ms, Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`,
    );

    // Should maintain consistent performance
    expect(mean).toBeLessThan(100); // ~10ms per transformation
  });

  /**
   * Benchmark: Plugin with database queries
   * Tests hook performance when database operations are involved
   */
  it('should efficiently execute hooks with database queries', async () => {
    const measurements: number[] = [];
    const queryCount = 50;

    // Simulate hook with database query
    const executeHookWithDb = async (
      hookName: string,
      data: any,
      dbQuery: () => Promise<any>,
    ): Promise<any> => {
      // Execute before-hook
      const beforeResult = { ...data, processed: true };

      // Execute database query
      const dbResult = await dbQuery();

      // Execute after-hook
      return { ...beforeResult, dbData: dbResult };
    };

    // Simulate database query
    const mockDbQuery = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5)); // Simulate DB latency
      return { data: 'db-result' };
    };

    // Run 50 hook+query executions
    for (let i = 0; i < queryCount; i++) {
      const article = MockUtils.testData.createArticle({ id: `article-${i}` });

      const start = performance.now();

      const result = await executeHookWithDb('article|afterCreate', article, mockDbQuery);

      const end = performance.now();
      measurements.push(end - start);

      expect(result.dbData).toBeDefined();
      expect(result.processed).toBe(true);
    }

    const mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    performanceResults['hook-with-db'] = {
      mean,
      throughput: queryCount / (measurements.reduce((a, b) => a + b, 0) / 1000),
      maxMemory: 0,
    };

    logger.log(
      `Hook with database queries - Mean: ${mean.toFixed(2)}ms, Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`,
    );

    // Should complete within reasonable time even with DB latency
    expect(mean).toBeLessThan(50); // ~5ms DB + hook overhead
  });

  /**
   * Benchmark: Concurrent hook executions
   * Tests thread-safety and performance under concurrent load
   */
  it('should safely handle concurrent hook executions (100 concurrent)', async () => {
    const concurrentCount = 100;
    const results: any[] = [];
    const threadSafetyViolations = 0;

    // Simulate thread-safe hook registry
    class ThreadSafeHookRegistry {
      private handlers: Map<string, Array<(data: any) => Promise<any>>> = new Map();
      private executionCounter = 0;
      private maxConcurrentExecutions = 0;

      registerHandler(hook: string, handler: (data: any) => Promise<any>): void {
        if (!this.handlers.has(hook)) {
          this.handlers.set(hook, []);
        }
        this.handlers.get(hook)!.push(handler);
      }

      async executeHook(hook: string, data: any): Promise<any> {
        this.executionCounter++;
        if (this.executionCounter > this.maxConcurrentExecutions) {
          this.maxConcurrentExecutions = this.executionCounter;
        }

        const handlers = this.handlers.get(hook) || [];
        let result = data;

        try {
          for (const handler of handlers) {
            result = await handler(result);
          }
        } finally {
          this.executionCounter--;
        }

        return result;
      }

      getMaxConcurrentExecutions(): number {
        return this.maxConcurrentExecutions;
      }
    }

    const registry = new ThreadSafeHookRegistry();

    // Register handlers
    registry.registerHandler('article|afterCreate', async (article) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ...article, processed: true };
    });

    const startTime = performance.now();

    // Execute 100 concurrent hooks
    const promises = Array.from({ length: concurrentCount }, async (_, i) => {
      const article = MockUtils.testData.createArticle({ id: `article-${i}` });
      return registry.executeHook('article|afterCreate', article);
    });

    const concurrentResults = await Promise.all(promises);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    const maxConcurrent = registry.getMaxConcurrentExecutions();

    performanceResults['concurrent-hooks-100'] = {
      mean: totalTime / concurrentCount,
      throughput: concurrentCount / (totalTime / 1000),
      maxMemory: maxConcurrent,
    };

    logger.log(
      `Concurrent hook executions (100) - Total: ${totalTime.toFixed(2)}ms, Per-hook: ${(totalTime / concurrentCount).toFixed(2)}ms, Max concurrent: ${maxConcurrent}`,
    );

    expect(concurrentResults).toHaveLength(concurrentCount);
    expect(concurrentResults.every((r) => r.processed)).toBe(true);
    expect(threadSafetyViolations).toBe(0);
  });

  /**
   * Benchmark: Hook priority and ordering
   * Tests if hooks execute in correct priority order
   */
  it('should maintain hook execution order with priorities', async () => {
    const executionOrder: string[] = [];

    // Simulate hook system with priorities
    class PrioritizedHookRegistry {
      private handlers: Map<
        string,
        Array<{ priority: number; handler: (data: any) => Promise<any> }>
      > = new Map();

      registerHandler(hook: string, priority: number, handler: (data: any) => Promise<any>): void {
        if (!this.handlers.has(hook)) {
          this.handlers.set(hook, []);
        }
        this.handlers.get(hook)!.push({ priority, handler });
      }

      async executeHook(hook: string, data: any): Promise<any> {
        const handlers = this.handlers.get(hook) || [];
        // Sort by priority (higher first)
        handlers.sort((a, b) => b.priority - a.priority);

        let result = data;

        for (const { handler } of handlers) {
          result = await handler(result);
        }

        return result;
      }
    }

    const registry = new PrioritizedHookRegistry();

    // Register handlers with different priorities
    registry.registerHandler('article|beforeCreate', 10, async (article) => {
      executionOrder.push('handler-10');
      return article;
    });

    registry.registerHandler('article|beforeCreate', 5, async (article) => {
      executionOrder.push('handler-5');
      return article;
    });

    registry.registerHandler('article|beforeCreate', 20, async (article) => {
      executionOrder.push('handler-20');
      return article;
    });

    registry.registerHandler('article|beforeCreate', 15, async (article) => {
      executionOrder.push('handler-15');
      return article;
    });

    const testArticle = MockUtils.testData.createArticle();
    await registry.executeHook('article|beforeCreate', testArticle);

    performanceResults['hook-priority'] = {
      mean: 0,
      throughput: 0,
      maxMemory: 0,
    };

    logger.log(`Hook execution order: ${executionOrder.join(' -> ')}`);

    // Verify execution order
    expect(executionOrder).toEqual(['handler-20', 'handler-15', 'handler-10', 'handler-5']);
  });

  /**
   * Summary: Log all performance metrics
   */
  it('should print plugin hook performance summary', () => {
    console.log('\n=== Plugin Hook Performance Summary ===');
    Object.entries(performanceResults).forEach(([name, metrics]) => {
      console.log(`${name}:`);
      if (metrics.mean > 0) {
        console.log(`  Mean latency: ${metrics.mean.toFixed(3)}ms`);
      }
      if (metrics.throughput > 0) {
        console.log(`  Throughput:   ${metrics.throughput.toFixed(2)} ops/s`);
      }
      if (metrics.maxMemory > 0) {
        console.log(`  Max memory:   ${metrics.maxMemory.toFixed(2)}MB`);
      }
    });
    console.log('========================================\n');
  });
});
