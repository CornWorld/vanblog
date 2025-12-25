import { of, throwError, firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { PerformanceInterceptor } from './performance.interceptor';

import type { LoggerService } from '../logger/logger.service';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

describe('PerformanceInterceptor', () => {
  let interceptor: PerformanceInterceptor;
  let mockLogger: LoggerService;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    // 启用 Fake Timers 以获得更稳定的时间控制
    vi.useFakeTimers();

    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as LoggerService;

    interceptor = new PerformanceInterceptor(mockLogger);

    mockExecutionContext = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          method: 'GET',
          url: '/api/test',
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
          headers: { 'user-agent': 'test-agent' },
        }),
        getResponse: vi.fn().mockReturnValue({
          statusCode: 200,
        }),
      }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: vi.fn().mockReturnValue(of('test response')),
    };

    // 重置统计数据
    PerformanceInterceptor.resetStats();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    PerformanceInterceptor.resetStats();
  });

  describe('基础功能测试', () => {
    it('应该在开发环境记录正常请求', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

        // 模拟请求耗时 100ms
        vi.advanceTimersByTime(100);
        await firstValueFrom(result);

        expect(mockLogger.log).toHaveBeenCalledWith(
          'GET /api/test 200 100ms [127.0.0.1]',
          'PerformanceInterceptor',
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('应该在生产环境不记录正常请求', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

        vi.advanceTimersByTime(100);
        await firstValueFrom(result);

        expect(mockLogger.log).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('应该记录慢请求警告', async () => {
      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      // 模拟请求耗时 1500ms（超过 SLOW_REQUEST_THRESHOLD 1000ms）
      vi.advanceTimersByTime(1500);
      await firstValueFrom(result);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SLOW REQUEST: GET /api/test 200 1500ms [127.0.0.1] - UA: test-agent',
        'PerformanceInterceptor',
      );
    });

    it('应该记录非常慢的请求错误', async () => {
      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      // 模拟请求耗时 3500ms（超过 VERY_SLOW_REQUEST_THRESHOLD 3000ms）
      vi.advanceTimersByTime(3500);
      await firstValueFrom(result);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'VERY SLOW REQUEST: GET /api/test 200 3500ms [127.0.0.1] - UA: test-agent',
        'PerformanceInterceptor',
      );
    });

    it('应该记录错误请求', async () => {
      const testError = new Error('Test error');
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => testError));

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      vi.advanceTimersByTime(200);

      try {
        await firstValueFrom(result);
      } catch {
        // 预期的错误
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/^GET \/api\/test 500 \d+ms \[127\.0\.0\.1\] - ERROR: Test error$/),
        testError.stack,
        'PerformanceInterceptor',
      );
    });
  });

  describe('端点性能统计测试', () => {
    it('应该正确记录端点统计信息', async () => {
      // 第一个请求：100ms
      const result1 = interceptor.intercept(mockExecutionContext, mockCallHandler);
      vi.advanceTimersByTime(100);
      await firstValueFrom(result1);

      // 第二个请求：200ms
      const result2 = interceptor.intercept(mockExecutionContext, mockCallHandler);
      vi.advanceTimersByTime(200);
      await firstValueFrom(result2);

      const stats = PerformanceInterceptor.getEndpointStats();
      const endpointStats = stats.get('GET /api/test');

      expect(endpointStats).toBeDefined();
      expect(endpointStats?.totalRequests).toBe(2);
      expect(endpointStats?.totalDuration).toBe(300);
      expect(endpointStats?.averageDuration).toBe(150);
      expect(endpointStats?.minDuration).toBe(100);
      expect(endpointStats?.maxDuration).toBe(200);
    });

    it('应该正确统计响应时间分布', async () => {
      // 快速请求：50ms
      const result1 = interceptor.intercept(mockExecutionContext, mockCallHandler);
      vi.advanceTimersByTime(50);
      await firstValueFrom(result1);

      // 正常请求：300ms
      const result2 = interceptor.intercept(mockExecutionContext, mockCallHandler);
      vi.advanceTimersByTime(300);
      await firstValueFrom(result2);

      // 慢请求：800ms
      const result3 = interceptor.intercept(mockExecutionContext, mockCallHandler);
      vi.advanceTimersByTime(800);
      await firstValueFrom(result3);

      // 非常慢请求：1500ms
      const result4 = interceptor.intercept(mockExecutionContext, mockCallHandler);
      vi.advanceTimersByTime(1500);
      await firstValueFrom(result4);

      const stats = PerformanceInterceptor.getEndpointStats();
      const endpointStats = stats.get('GET /api/test');

      expect(endpointStats?.responseTimeDistribution.fast).toBe(1);
      expect(endpointStats?.responseTimeDistribution.normal).toBe(1);
      expect(endpointStats?.responseTimeDistribution.slow).toBe(1);
      expect(endpointStats?.responseTimeDistribution.verySlow).toBe(1);
    });

    it('应该正确生成性能摘要', async () => {
      // 端点1：快速请求 50ms
      const result1 = interceptor.intercept(mockExecutionContext, mockCallHandler);
      vi.advanceTimersByTime(50);
      await firstValueFrom(result1);

      // 端点2：慢请求 1500ms
      const slowContext = {
        ...mockExecutionContext,
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            method: 'POST',
            url: '/api/slow',
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
            headers: { 'user-agent': 'test-agent' },
          }),
          getResponse: vi.fn().mockReturnValue({
            statusCode: 200,
          }),
        }),
      } as unknown as ExecutionContext;

      const result2 = interceptor.intercept(slowContext, mockCallHandler);
      vi.advanceTimersByTime(1500);
      await firstValueFrom(result2);

      const summary = PerformanceInterceptor.getPerformanceSummary();

      expect(summary.totalEndpoints).toBe(2);
      expect(summary.slowEndpoints).toBe(1);
      expect(summary.totalRequests).toBe(2);
      expect(summary.averageResponseTime).toBe(775); // (50 + 1500) / 2
      expect(summary.responseTimeDistribution.fast).toBe(1);
      expect(summary.responseTimeDistribution.verySlow).toBe(1);
    });

    it('应该限制最大端点数量', async () => {
      // 创建超过限制的端点数量（模拟1001个端点）
      for (let i = 0; i < 1001; i++) {
        const context = {
          ...mockExecutionContext,
          switchToHttp: vi.fn().mockReturnValue({
            getRequest: vi.fn().mockReturnValue({
              method: 'GET',
              url: `/api/test-${String(i)}`,
              ip: '127.0.0.1',
              socket: { remoteAddress: '127.0.0.1' },
              headers: { 'user-agent': 'test-agent' },
            }),
            getResponse: vi.fn().mockReturnValue({
              statusCode: 200,
            }),
          }),
        } as unknown as ExecutionContext;

        const result = interceptor.intercept(context, mockCallHandler);
        vi.advanceTimersByTime(1);
        await firstValueFrom(result);
      }

      const stats = PerformanceInterceptor.getEndpointStats();
      expect(stats.size).toBe(1000); // 应该限制在1000个
    });
  });

  describe('静态方法测试', () => {
    it('应该能够重置统计数据', async () => {
      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      vi.advanceTimersByTime(100);
      await firstValueFrom(result);

      expect(PerformanceInterceptor.getEndpointStats().size).toBe(1);

      PerformanceInterceptor.resetStats();

      expect(PerformanceInterceptor.getEndpointStats().size).toBe(0);
      expect(PerformanceInterceptor.getPerformanceSummary().totalEndpoints).toBe(0);
    });

    it('应该返回端点统计的副本', async () => {
      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      vi.advanceTimersByTime(100);
      await firstValueFrom(result);

      const stats1 = PerformanceInterceptor.getEndpointStats();
      const stats2 = PerformanceInterceptor.getEndpointStats();

      expect(stats1).not.toBe(stats2); // 应该是不同的对象实例
      expect(stats1.size).toBe(stats2.size); // 但内容相同
    });
  });
});
