import { Test, type TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

import { PerformanceInterceptor } from '../../core/interceptors/performance.interceptor';
import { PerformanceMonitoringMiddleware } from '../middleware/performance-monitoring.middleware';

import { ErrorRateMonitoringService } from './error-rate-monitoring.service';

describe('ErrorRateMonitoringService', () => {
  let service: ErrorRateMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorRateMonitoringService],
    }).compile();

    service = module.get<ErrorRateMonitoringService>(ErrorRateMonitoringService);

    // 重置性能监控数据
    PerformanceMonitoringMiddleware.resetStats();
    PerformanceInterceptor.resetStats();
  });

  describe('getGlobalErrorRate', () => {
    it('should return 0 when no requests', () => {
      expect(service.getGlobalErrorRate()).toBe(0);
    });

    it('should calculate correct global error rate', () => {
      // 模拟性能监控中间件数据
      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue({
        averageResponseTime: 100,
        totalRequests: 100,
        errorRequests: 5,
        slowRequests: 10,
        requestsPerSecond: 10,
        memoryTrend: [50, 55, 60],
        topSlowEndpoints: [],
      });

      expect(service.getGlobalErrorRate()).toBe(5);
    });
  });

  describe('getEndpointErrorRates', () => {
    it('should return empty array when no endpoint data', () => {
      vi.spyOn(PerformanceMonitoringMiddleware, 'getDetailedMetrics').mockReturnValue({
        slowRequestThreshold: 1000,
        verySlowRequestThreshold: 3000,
        memoryUsage: { heapUsed: 50, heapTotal: 100, external: 10, rss: 120, arrayBuffers: 5 },
        uptime: 0,
        stats: {
          totalRequests: 0,
          averageResponseTime: 0,
          slowRequests: 0,
          errorRequests: 0,
          requestsPerSecond: 0,
          memoryTrend: [],
          topSlowEndpoints: [],
        },
        recentRequests: [],
        endpointStats: [],
      });

      vi.spyOn(PerformanceInterceptor, 'getEndpointStats').mockReturnValue(new Map());

      const result = service.getEndpointErrorRates();
      expect(result).toEqual([]);
    });

    it('should calculate endpoint error rates with performance correlation', () => {
      // 模拟中间件数据
      vi.spyOn(PerformanceMonitoringMiddleware, 'getDetailedMetrics').mockReturnValue({
        slowRequestThreshold: 1000,
        verySlowRequestThreshold: 3000,
        memoryUsage: { heapUsed: 50, heapTotal: 100, external: 10, rss: 120, arrayBuffers: 5 },
        uptime: 3600,
        stats: {
          totalRequests: 100,
          averageResponseTime: 500,
          slowRequests: 10,
          errorRequests: 8,
          requestsPerSecond: 10,
          memoryTrend: [50, 55, 60],
          topSlowEndpoints: [],
        },
        recentRequests: [],
        endpointStats: [
          {
            endpoint: '/api/test',
            avgDuration: 500,
            count: 100,
            errorRate: 8,
          },
        ],
      });

      // 模拟拦截器数据
      const mockEndpointStats = new Map();
      mockEndpointStats.set('/api/test', {
        totalRequests: 100,
        averageDuration: 500,
        responseTimeDistribution: {
          fast: 70,
          normal: 20,
          slow: 8,
          verySlow: 2,
        },
      });

      vi.spyOn(PerformanceInterceptor, 'getEndpointStats').mockReturnValue(mockEndpointStats);

      const result = service.getEndpointErrorRates();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        endpoint: '/api/test',
        errorRate: 8,
        errorCount: 8,
        totalRequests: 100,
        severity: 'warning',
        averageResponseTime: 500,
        slowRequestRatio: 10, // (8 + 2) / 100 * 100
        errorResponseTimeCorrelation: 'low',
      });
    });

    it('should detect high performance-error correlation', () => {
      vi.spyOn(PerformanceMonitoringMiddleware, 'getDetailedMetrics').mockReturnValue({
        slowRequestThreshold: 1000,
        verySlowRequestThreshold: 3000,
        memoryUsage: { heapUsed: 50, heapTotal: 100, external: 10, rss: 120, arrayBuffers: 5 },
        uptime: 3600,
        stats: {
          totalRequests: 100,
          averageResponseTime: 2000,
          slowRequests: 75,
          errorRequests: 15,
          requestsPerSecond: 10,
          memoryTrend: [50, 55, 60],
          topSlowEndpoints: [],
        },
        recentRequests: [],
        endpointStats: [
          {
            endpoint: '/api/slow',
            avgDuration: 2000,
            count: 100,
            errorRate: 15,
          },
        ],
      });

      const mockEndpointStats = new Map();
      mockEndpointStats.set('/api/slow', {
        totalRequests: 100,
        averageDuration: 2000,
        responseTimeDistribution: {
          fast: 20,
          normal: 5,
          slow: 50,
          verySlow: 25,
        },
      });

      vi.spyOn(PerformanceInterceptor, 'getEndpointStats').mockReturnValue(mockEndpointStats);

      const result = service.getEndpointErrorRates();

      expect(result[0]).toMatchObject({
        endpoint: '/api/slow',
        errorRate: 15,
        severity: 'critical',
        slowRequestRatio: 75, // (50 + 25) / 100 * 100
        errorResponseTimeCorrelation: 'high',
      });
    });
  });

  describe('getErrorRateAlerts', () => {
    it('should generate critical global error rate alert', () => {
      vi.spyOn(service, 'getGlobalErrorRate').mockReturnValue(12);
      vi.spyOn(service, 'getEndpointErrorRates').mockReturnValue([]);

      const alerts = service.getErrorRateAlerts();

      expect(alerts).toContainEqual({
        type: 'critical',
        message: 'Critical global error rate: 12.0%',
        errorRate: 12,
        category: 'error_rate',
      });
    });

    it('should generate performance correlation alerts', () => {
      vi.spyOn(service, 'getGlobalErrorRate').mockReturnValue(2);
      vi.spyOn(service, 'getEndpointErrorRates').mockReturnValue([
        {
          endpoint: '/api/problematic',
          errorRate: 8,
          errorCount: 8,
          totalRequests: 100,
          severity: 'warning',
          averageResponseTime: 1500,
          slowRequestRatio: 80,
          errorResponseTimeCorrelation: 'high',
        },
      ]);

      const alerts = service.getErrorRateAlerts();

      expect(alerts).toContainEqual({
        type: 'warning',
        message:
          'High correlation between slow requests and errors for /api/problematic: 80.0% slow requests, 8.0% error rate',
        endpoint: '/api/problematic',
        errorRate: 8,
        category: 'performance_correlation',
      });
    });

    it('should generate high error count alerts', () => {
      vi.spyOn(service, 'getGlobalErrorRate').mockReturnValue(2);
      vi.spyOn(service, 'getEndpointErrorRates').mockReturnValue([
        {
          endpoint: '/api/busy',
          errorRate: 3,
          errorCount: 60,
          totalRequests: 2000,
          severity: 'normal',
          averageResponseTime: 200,
          slowRequestRatio: 5,
          errorResponseTimeCorrelation: 'low',
        },
      ]);

      const alerts = service.getErrorRateAlerts();

      expect(alerts).toContainEqual({
        type: 'warning',
        message: 'High error count for /api/busy: 60 errors',
        endpoint: '/api/busy',
        errorRate: 3,
        category: 'error_count',
      });
    });
  });

  describe('getErrorRateSummary', () => {
    it('should provide comprehensive error rate summary', () => {
      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue({
        averageResponseTime: 300,
        totalRequests: 1000,
        errorRequests: 25,
        slowRequests: 50,
        requestsPerSecond: 10,
        memoryTrend: [50, 55, 60],
        topSlowEndpoints: [],
      });

      vi.spyOn(service, 'getEndpointErrorRates').mockReturnValue([
        {
          endpoint: '/api/test1',
          errorRate: 8,
          errorCount: 8,
          totalRequests: 100,
          severity: 'warning',
          averageResponseTime: 400,
          slowRequestRatio: 15,
          errorResponseTimeCorrelation: 'medium',
        },
        {
          endpoint: '/api/test2',
          errorRate: 12,
          errorCount: 12,
          totalRequests: 100,
          severity: 'critical',
          averageResponseTime: 800,
          slowRequestRatio: 30,
          errorResponseTimeCorrelation: 'high',
        },
      ]);

      vi.spyOn(service, 'getErrorRateAlerts').mockReturnValue([
        {
          type: 'warning',
          message: 'Test alert',
          errorRate: 8,
          category: 'performance_correlation',
        },
      ]);

      vi.spyOn(PerformanceInterceptor, 'getPerformanceSummary').mockReturnValue({
        totalEndpoints: 10,
        slowEndpoints: 2,
        averageResponseTime: 300,
        totalRequests: 1000,
        responseTimeDistribution: {
          fast: 800,
          normal: 140,
          slow: 50,
          verySlow: 10,
        },
      });

      const summary = service.getErrorRateSummary();

      expect(summary).toMatchObject({
        globalErrorRate: 2.5,
        totalErrors: 25,
        totalRequests: 1000,
        highErrorEndpoints: 2,
        criticalErrorEndpoints: 1,
        alertCount: 1,
        performanceCorrelationAlerts: 1,
        averageResponseTime: 300,
        slowRequestRatio: 6, // (50 + 10) / 1000 * 100
      });
    });
  });

  describe('getSystemHealthStatus', () => {
    it('should return healthy status for normal system', () => {
      vi.spyOn(service, 'getGlobalErrorRate').mockReturnValue(1);
      vi.spyOn(service, 'getErrorRateAlerts').mockReturnValue([]);
      vi.spyOn(service, 'getErrorRateSummary').mockReturnValue({
        globalErrorRate: 1,
        totalErrors: 10,
        totalRequests: 1000,
        highErrorEndpoints: 0,
        criticalErrorEndpoints: 0,
        alertCount: 0,
        performanceCorrelationAlerts: 0,
        averageResponseTime: 200,
        slowRequestRatio: 5,
      });

      const health = service.getSystemHealthStatus();

      expect(health).toMatchObject({
        status: 'healthy',
        message: 'System error rates and performance are within normal range',
        errorRate: 1,
        factors: ['All error rates within normal range', 'Average response time: 200ms'],
      });
    });

    it('should return critical status for high error rates', () => {
      vi.spyOn(service, 'getGlobalErrorRate').mockReturnValue(15);
      vi.spyOn(service, 'getErrorRateAlerts').mockReturnValue([
        {
          type: 'critical',
          message: 'Critical global error rate: 15.0%',
          errorRate: 15,
          category: 'error_rate',
        },
      ]);
      vi.spyOn(service, 'getErrorRateSummary').mockReturnValue({
        globalErrorRate: 15,
        totalErrors: 150,
        totalRequests: 1000,
        highErrorEndpoints: 3,
        criticalErrorEndpoints: 2,
        alertCount: 1,
        performanceCorrelationAlerts: 0,
        averageResponseTime: 500,
        slowRequestRatio: 25,
      });

      const health = service.getSystemHealthStatus();

      expect(health).toMatchObject({
        status: 'critical',
        message: 'System has critical error rates',
        errorRate: 15,
        factors: ['Critical global error rate: 15.0%', '2 endpoints with critical error rates'],
      });
    });

    it('should return warning status for performance issues', () => {
      vi.spyOn(service, 'getGlobalErrorRate').mockReturnValue(3);
      vi.spyOn(service, 'getErrorRateAlerts').mockReturnValue([
        {
          type: 'warning',
          message: 'Performance correlation alert',
          errorRate: 3,
          category: 'performance_correlation',
        },
      ]);
      vi.spyOn(service, 'getErrorRateSummary').mockReturnValue({
        globalErrorRate: 3,
        totalErrors: 30,
        totalRequests: 1000,
        highErrorEndpoints: 1,
        criticalErrorEndpoints: 0,
        alertCount: 1,
        performanceCorrelationAlerts: 1,
        averageResponseTime: 800,
        slowRequestRatio: 25,
      });

      const health = service.getSystemHealthStatus();

      expect(health).toMatchObject({
        status: 'warning',
        message: 'System has elevated error rates or performance issues',
        errorRate: 3,
        factors: [
          '1 endpoints with high error rates',
          '1 endpoints with performance-error correlation',
          'High slow request ratio: 25.0%',
        ],
      });
    });
  });

  describe('getErrorRateTrendAnalysis', () => {
    it('should identify degrading trend with critical endpoints', () => {
      vi.spyOn(service, 'getEndpointErrorRates').mockReturnValue([
        {
          endpoint: '/api/critical1',
          errorRate: 15,
          errorCount: 15,
          totalRequests: 100,
          severity: 'critical',
          averageResponseTime: 1000,
          slowRequestRatio: 40,
          errorResponseTimeCorrelation: 'high',
        },
        {
          endpoint: '/api/critical2',
          errorRate: 12,
          errorCount: 12,
          totalRequests: 100,
          severity: 'critical',
          averageResponseTime: 800,
          slowRequestRatio: 30,
          errorResponseTimeCorrelation: 'medium',
        },
      ]);

      vi.spyOn(service, 'getGlobalErrorRate').mockReturnValue(8);

      const analysis = service.getErrorRateTrendAnalysis();

      expect(analysis).toMatchObject({
        trend: 'degrading',
        recommendation:
          'Immediate attention required for 2 critical endpoints. Focus on: /api/critical1, /api/critical2.',
        criticalEndpoints: ['/api/critical1', '/api/critical2'],
        performanceImpactedEndpoints: ['/api/critical1'],
      });
    });

    it('should identify improving trend for healthy system', () => {
      vi.spyOn(service, 'getEndpointErrorRates').mockReturnValue([
        {
          endpoint: '/api/healthy',
          errorRate: 0.5,
          errorCount: 1,
          totalRequests: 200,
          severity: 'normal',
          averageResponseTime: 150,
          slowRequestRatio: 2,
          errorResponseTimeCorrelation: 'low',
        },
      ]);

      vi.spyOn(service, 'getGlobalErrorRate').mockReturnValue(0.5);

      const analysis = service.getErrorRateTrendAnalysis();

      expect(analysis).toMatchObject({
        trend: 'improving',
        recommendation:
          'System is performing well. Maintain current monitoring and optimization practices.',
        criticalEndpoints: [],
        performanceImpactedEndpoints: [],
      });
    });

    it('should identify performance-related degradation', () => {
      vi.spyOn(service, 'getEndpointErrorRates').mockReturnValue([
        {
          endpoint: '/api/slow',
          errorRate: 4,
          errorCount: 8,
          totalRequests: 200,
          severity: 'normal',
          averageResponseTime: 1500,
          slowRequestRatio: 80,
          errorResponseTimeCorrelation: 'high',
        },
      ]);

      vi.spyOn(service, 'getGlobalErrorRate').mockReturnValue(2);

      const analysis = service.getErrorRateTrendAnalysis();

      expect(analysis).toMatchObject({
        trend: 'degrading',
        recommendation:
          'Performance optimization needed for 1 endpoints with high error-performance correlation.',
        criticalEndpoints: [],
        performanceImpactedEndpoints: ['/api/slow'],
      });
    });
  });

  describe('logErrorRateAlerts', () => {
    it('should log alerts with proper categories', () => {
      const loggerErrorSpy = vi.spyOn(service['logger'], 'error');
      const loggerWarnSpy = vi.spyOn(service['logger'], 'warn');

      vi.spyOn(service, 'getErrorRateAlerts').mockReturnValue([
        {
          type: 'critical',
          message: 'Critical error rate',
          errorRate: 15,
          category: 'error_rate',
        },
        {
          type: 'warning',
          message: 'Performance correlation issue',
          errorRate: 5,
          category: 'performance_correlation',
        },
      ]);

      service.logErrorRateAlerts();

      expect(loggerErrorSpy).toHaveBeenCalledWith('[ERROR_RATE] Critical error rate');
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        '[PERFORMANCE_CORRELATION] Performance correlation issue',
      );
    });
  });
});
