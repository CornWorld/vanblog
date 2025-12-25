import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitoringMiddleware } from './performance-monitoring.middleware';
import type { Request, Response, NextFunction } from 'express';

describe('PerformanceMonitoringMiddleware', () => {
  let middleware: PerformanceMonitoringMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let finishCallback: (() => void) | null = null;

  beforeEach(() => {
    // Reset static data before each test
    PerformanceMonitoringMiddleware.resetStats();

    middleware = new PerformanceMonitoringMiddleware();
    mockRequest = {
      method: 'GET',
      originalUrl: '/test',
      ip: '127.0.0.1',
      get: vi.fn((header: string) => {
        if (header === 'User-Agent') return 'test-agent';
        return undefined;
      }),
    } as Partial<Request>;

    finishCallback = null;
    mockResponse = {
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      }),
      statusCode: 200,
    } as Partial<Response>;

    mockNext = vi.fn();

    // Mock environment variable
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    PerformanceMonitoringMiddleware.resetStats();
  });

  describe('basic functionality', () => {
    it('should be defined', () => {
      expect(middleware).toBeDefined();
      expect(middleware.use).toBeDefined();
    });

    it('should call next middleware', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should register finish event listener', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should collect metrics when response finishes', async () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Trigger finish event
      if (finishCallback) {
        finishCallback();
      }

      const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
    });
  });

  describe('logging', () => {
    it('should log slow request (>1s)', async () => {
      const loggerWarnSpy = vi.spyOn((middleware as any).logger, 'warn');

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Wait to simulate slow request
      await new Promise<void>((resolve) => setTimeout(resolve, 1100));

      if (finishCallback) {
        finishCallback();
      }

      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should log very slow request (>3s)', async () => {
      const loggerWarnSpy = vi.spyOn((middleware as any).logger, 'warn');

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Wait to simulate very slow request
      await new Promise((resolve) => setTimeout(resolve, 3100));

      if (finishCallback) {
        finishCallback();
      }

      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should log normal request', () => {
      const loggerLogSpy = vi.spyOn((middleware as any).logger, 'log');

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      if (finishCallback) {
        finishCallback();
      }

      expect(loggerLogSpy).toHaveBeenCalled();
    });

    it('should log debug message in development mode', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const loggerDebugSpy = vi.spyOn((middleware as any).logger, 'debug');

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).toHaveBeenCalled();
      vi.unstubAllEnvs();
    });
  });

  describe('performance stats', () => {
    it('should return performance stats', () => {
      const stats = PerformanceMonitoringMiddleware.getPerformanceStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('slowRequests');
      expect(stats).toHaveProperty('errorRequests');
      expect(stats).toHaveProperty('requestsPerSecond');
      expect(stats).toHaveProperty('memoryTrend');
      expect(stats).toHaveProperty('topSlowEndpoints');
    });

    it('should calculate correct average response time', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should track error requests', () => {
      mockResponse.statusCode = 500;
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
      expect(stats.errorRequests).toBe(1);
    });

    it('should track top slow endpoints', async () => {
      mockRequest.originalUrl = '/slow-endpoint';
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      await new Promise((resolve) => setTimeout(resolve, 100));

      if (finishCallback) finishCallback();

      const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
      expect(stats.topSlowEndpoints).toBeDefined();
      expect(Array.isArray(stats.topSlowEndpoints)).toBe(true);
    });
  });

  describe('detailed metrics', () => {
    it('should return detailed metrics', () => {
      const metrics = PerformanceMonitoringMiddleware.getDetailedMetrics();

      expect(metrics).toHaveProperty('slowRequestThreshold');
      expect(metrics).toHaveProperty('verySlowRequestThreshold');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('stats');
      expect(metrics).toHaveProperty('recentRequests');
      expect(metrics).toHaveProperty('endpointStats');
    });

    it('should include recent requests', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      const metrics = PerformanceMonitoringMiddleware.getDetailedMetrics();
      expect(metrics.recentRequests.length).toBeGreaterThan(0);
    });

    it('should include endpoint stats', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      const metrics = PerformanceMonitoringMiddleware.getDetailedMetrics();
      expect(Array.isArray(metrics.endpointStats)).toBe(true);
    });

    it('should calculate endpoint error rate', () => {
      mockResponse.statusCode = 404;
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      const metrics = PerformanceMonitoringMiddleware.getDetailedMetrics();
      const endpoint = metrics.endpointStats.find((e) => e.endpoint.includes('/test'));
      expect(endpoint).toBeDefined();
      if (endpoint) {
        expect(endpoint.errorRate).toBeGreaterThan(0);
      }
    });
  });

  describe('memory trend', () => {
    it('should return memory trend', () => {
      const trend = PerformanceMonitoringMiddleware.getMemoryTrend();

      expect(trend).toHaveProperty('current');
      expect(trend).toHaveProperty('trend');
      expect(trend).toHaveProperty('average');
      expect(trend).toHaveProperty('peak');
      expect(trend).toHaveProperty('isIncreasing');
    });

    it('should detect increasing memory trend', () => {
      const trend = PerformanceMonitoringMiddleware.getMemoryTrend();
      expect(typeof trend.isIncreasing).toBe('boolean');
    });

    it('should calculate peak memory', () => {
      const trend = PerformanceMonitoringMiddleware.getMemoryTrend();
      expect(trend.peak).toBeGreaterThan(0);
    });
  });

  describe('performance warnings', () => {
    it('should return performance warnings', () => {
      const warnings = PerformanceMonitoringMiddleware.getPerformanceWarnings();
      expect(Array.isArray(warnings)).toBe(true);
    });

    it('should warn about high average response time', async () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate slow request
      await new Promise<void>((resolve) => setTimeout(resolve, 2100));

      if (finishCallback) finishCallback();

      const warnings = PerformanceMonitoringMiddleware.getPerformanceWarnings();
      const hasResponseTimeWarning = warnings.some((w) => w.includes('response time'));
      expect(hasResponseTimeWarning).toBe(true);
    });

    it('should warn about high error rate', () => {
      // Create multiple error requests
      for (let i = 0; i < 10; i++) {
        mockResponse.statusCode = 500;
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        if (finishCallback) finishCallback();

        // Reset for next iteration
        finishCallback = null;
        mockResponse = {
          on: vi.fn((event: string, callback: () => void) => {
            if (event === 'finish') {
              finishCallback = callback;
            }
          }),
          statusCode: 500,
        } as Partial<Response>;
      }

      const warnings = PerformanceMonitoringMiddleware.getPerformanceWarnings();
      const hasErrorRateWarning = warnings.some((w) => w.includes('error rate'));
      expect(hasErrorRateWarning).toBe(true);
    });
  });

  describe('reset stats', () => {
    it('should reset all statistics', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      PerformanceMonitoringMiddleware.resetStats();

      const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
      expect(stats.totalRequests).toBe(0);
    });

    it('should clear metrics history', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      PerformanceMonitoringMiddleware.resetStats();

      const metrics = PerformanceMonitoringMiddleware.getDetailedMetrics();
      expect(metrics.recentRequests.length).toBe(0);
    });

    it('should clear endpoint stats', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      PerformanceMonitoringMiddleware.resetStats();

      const metrics = PerformanceMonitoringMiddleware.getDetailedMetrics();
      expect(metrics.endpointStats.length).toBe(0);
    });
  });

  describe('performance metrics', () => {
    it('should return basic performance metrics', () => {
      const metrics = PerformanceMonitoringMiddleware.getPerformanceMetrics();

      expect(metrics.slowRequestThreshold).toBe(1000);
      expect(metrics.verySlowRequestThreshold).toBe(3000);
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.uptime).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle request without IP', () => {
      mockRequest.ip = undefined;
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      const metrics = PerformanceMonitoringMiddleware.getDetailedMetrics();
      expect(metrics.recentRequests[0].ip).toBe('unknown');
    });

    it('should handle request without User-Agent', () => {
      mockRequest.get = vi.fn(() => undefined);
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      const metrics = PerformanceMonitoringMiddleware.getDetailedMetrics();
      expect(metrics.recentRequests[0].userAgent).toBe('Unknown');
    });

    it('should handle multiple concurrent requests', () => {
      for (let i = 0; i < 5; i++) {
        const req = { ...mockRequest, originalUrl: `/test${i}` };
        const res = {
          on: vi.fn((event: string, callback: () => void) => {
            if (event === 'finish') {
              callback();
            }
          }),
          statusCode: 200,
        };
        middleware.use(req as Request, res as Response, mockNext);
      }

      const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
      expect(stats.totalRequests).toBe(5);
    });

    it('should maintain maximum history size', () => {
      // Create more than MAX_METRICS_HISTORY requests
      for (let i = 0; i < 1100; i++) {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        if (finishCallback) finishCallback();

        // Reset callback for next iteration
        finishCallback = null;
        mockResponse = {
          on: vi.fn((event: string, callback: () => void) => {
            if (event === 'finish') {
              finishCallback = callback;
            }
          }),
          statusCode: 200,
        } as Partial<Response>;
      }

      const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
      expect(stats.totalRequests).toBeLessThanOrEqual(1000);
    });
  });

  describe('memory snapshot', () => {
    it('should record memory snapshots', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      const trend = PerformanceMonitoringMiddleware.getMemoryTrend();
      expect(Array.isArray(trend.trend)).toBe(true);
    });
  });

  describe('endpoint statistics', () => {
    it('should track statistics per endpoint', () => {
      mockRequest.originalUrl = '/api/test';
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      if (finishCallback) finishCallback();

      const metrics = PerformanceMonitoringMiddleware.getDetailedMetrics();
      const endpoint = metrics.endpointStats.find((e) => e.endpoint.includes('/api/test'));
      expect(endpoint).toBeDefined();
      if (endpoint) {
        expect(endpoint.count).toBeGreaterThan(0);
      }
    });

    it('should accumulate endpoint statistics', () => {
      mockRequest.originalUrl = '/api/accumulate';

      for (let i = 0; i < 3; i++) {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        if (finishCallback) finishCallback();

        // Reset callback for next iteration
        finishCallback = null;
        mockResponse = {
          on: vi.fn((event: string, callback: () => void) => {
            if (event === 'finish') {
              finishCallback = callback;
            }
          }),
          statusCode: 200,
        } as Partial<Response>;
      }

      const metrics = PerformanceMonitoringMiddleware.getDetailedMetrics();
      const endpoint = metrics.endpointStats.find((e) => e.endpoint.includes('/api/accumulate'));
      expect(endpoint).toBeDefined();
      if (endpoint) {
        expect(endpoint.count).toBe(3);
      }
    });
  });
});
