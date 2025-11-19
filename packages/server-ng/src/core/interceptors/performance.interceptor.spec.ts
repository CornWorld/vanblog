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
    vi.restoreAllMocks();
    PerformanceInterceptor.resetStats();
  });

  describe('基础功能测试', () => {
    it('应该在开发环境记录正常请求', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockDateNow = vi.spyOn(Date, 'now');
      // 第一次调用：startTime = 1000
      // 第二次调用：tap中的duration计算 = 1100
      // 第三次调用：logRequest中的duration计算 = 1100
      mockDateNow.mockReturnValueOnce(1000).mockReturnValueOnce(1100).mockReturnValueOnce(1100);

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'GET /api/test 200 100ms [127.0.0.1]',
        'PerformanceInterceptor',
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('应该在生产环境不记录正常请求', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockDateNow = vi.spyOn(Date, 'now');
      // 第一次调用：startTime = 1000
      // 第二次调用：tap中的duration计算 = 1100
      // 第三次调用：logRequest中的duration计算 = 1100
      mockDateNow.mockReturnValueOnce(1000).mockReturnValueOnce(1100).mockReturnValueOnce(1100);

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      expect(mockLogger.log).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('应该记录慢请求警告', async () => {
      const mockDateNow = vi.spyOn(Date, 'now');
      // 第一次调用：startTime = 1000
      // 第二次调用：tap中的duration计算 = 2500
      // 第三次调用：logRequest中的duration计算 = 2500
      mockDateNow.mockReturnValueOnce(1000).mockReturnValueOnce(2500).mockReturnValueOnce(2500);

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SLOW REQUEST: GET /api/test 200 1500ms [127.0.0.1] - UA: test-agent',
        'PerformanceInterceptor',
      );
    });

    it('应该记录非常慢的请求错误', async () => {
      const mockDateNow = vi.spyOn(Date, 'now');
      // 第一次调用：startTime = 1000
      // 第二次调用：tap中的duration计算 = 4500
      // 第三次调用：logRequest中的duration计算 = 4500
      mockDateNow.mockReturnValueOnce(1000).mockReturnValueOnce(4500).mockReturnValueOnce(4500);

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'VERY SLOW REQUEST: GET /api/test 200 3500ms [127.0.0.1] - UA: test-agent',
        'PerformanceInterceptor',
      );
    });

    it('应该记录错误请求', async () => {
      const testError = new Error('Test error');
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => testError));

      const mockDateNow = vi.spyOn(Date, 'now');
      mockDateNow.mockReturnValueOnce(1000).mockReturnValueOnce(1200); // 200ms duration

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

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
      const mockDateNow = vi.spyOn(Date, 'now');

      // 第一个请求：100ms
      mockDateNow.mockReturnValueOnce(1000).mockReturnValueOnce(1100);
      let result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      // 第二个请求：200ms
      mockDateNow.mockReturnValueOnce(2000).mockReturnValueOnce(2200);
      result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

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
      const mockDateNow = vi.spyOn(Date, 'now');

      // 快速请求：50ms
      mockDateNow.mockReturnValueOnce(1000).mockReturnValueOnce(1050);
      let result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      // 正常请求：300ms
      mockDateNow.mockReturnValueOnce(2000).mockReturnValueOnce(2300);
      result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      // 慢请求：800ms
      mockDateNow.mockReturnValueOnce(3000).mockReturnValueOnce(3800);
      result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      // 非常慢请求：1500ms
      mockDateNow.mockReturnValueOnce(4000).mockReturnValueOnce(5500);
      result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      const stats = PerformanceInterceptor.getEndpointStats();
      const endpointStats = stats.get('GET /api/test');

      expect(endpointStats?.responseTimeDistribution.fast).toBe(1);
      expect(endpointStats?.responseTimeDistribution.normal).toBe(1);
      expect(endpointStats?.responseTimeDistribution.slow).toBe(1);
      expect(endpointStats?.responseTimeDistribution.verySlow).toBe(1);
    });

    it('应该正确生成性能摘要', async () => {
      const mockDateNow = vi.spyOn(Date, 'now');

      // 添加多个端点的请求
      // 端点1：快速请求
      mockDateNow.mockReturnValueOnce(1000).mockReturnValueOnce(1050);
      let result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      // 端点2：慢请求
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

      mockDateNow.mockReturnValueOnce(2000).mockReturnValueOnce(3500); // 1500ms
      result = interceptor.intercept(slowContext, mockCallHandler);
      await firstValueFrom(result);

      const summary = PerformanceInterceptor.getPerformanceSummary();

      expect(summary.totalEndpoints).toBe(2);
      expect(summary.slowEndpoints).toBe(1);
      expect(summary.totalRequests).toBe(2);
      expect(summary.averageResponseTime).toBe(775); // (50 + 1500) / 2
      expect(summary.responseTimeDistribution.fast).toBe(1);
      expect(summary.responseTimeDistribution.verySlow).toBe(1);
    });

    it('应该限制最大端点数量', async () => {
      const mockDateNow = vi.spyOn(Date, 'now');

      // 创建超过限制的端点数量（模拟1001个端点）
      for (let i = 0; i < 1001; i++) {
        const context = {
          ...mockExecutionContext,
          switchToHttp: vi.fn().mockReturnValue({
            getRequest: vi.fn().mockReturnValue({
              method: 'GET',
              url: `/api/test-${i}`,
              ip: '127.0.0.1',
              socket: { remoteAddress: '127.0.0.1' },
              headers: { 'user-agent': 'test-agent' },
            }),
            getResponse: vi.fn().mockReturnValue({
              statusCode: 200,
            }),
          }),
        } as unknown as ExecutionContext;

        mockDateNow.mockReturnValueOnce(1000 + i).mockReturnValueOnce(1100 + i);
        const result = interceptor.intercept(context, mockCallHandler);
        await firstValueFrom(result);
      }

      const stats = PerformanceInterceptor.getEndpointStats();
      expect(stats.size).toBe(1000); // 应该限制在1000个
    });
  });

  describe('静态方法测试', () => {
    it('应该能够重置统计数据', async () => {
      const mockDateNow = vi.spyOn(Date, 'now');
      mockDateNow.mockReturnValueOnce(1000).mockReturnValueOnce(1100);

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      expect(PerformanceInterceptor.getEndpointStats().size).toBe(1);

      PerformanceInterceptor.resetStats();

      expect(PerformanceInterceptor.getEndpointStats().size).toBe(0);
      expect(PerformanceInterceptor.getPerformanceSummary().totalEndpoints).toBe(0);
    });

    it('应该返回端点统计的副本', async () => {
      const mockDateNow = vi.spyOn(Date, 'now');
      mockDateNow.mockReturnValueOnce(1000).mockReturnValueOnce(1100);

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await firstValueFrom(result);

      const stats1 = PerformanceInterceptor.getEndpointStats();
      const stats2 = PerformanceInterceptor.getEndpointStats();

      expect(stats1).not.toBe(stats2); // 应该是不同的对象实例
      expect(stats1.size).toBe(stats2.size); // 但内容相同
    });
  });
});
