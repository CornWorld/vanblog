import { Test, type TestingModule } from '@nestjs/testing';

import { PerformanceMonitoringMiddleware } from '../middleware/performance-monitoring.middleware';

import { ErrorRateMonitoringService } from './error-rate-monitoring.service';

describe('ErrorRateMonitoringService', () => {
  let service: ErrorRateMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorRateMonitoringService],
    }).compile();

    service = module.get<ErrorRateMonitoringService>(ErrorRateMonitoringService);

    // Reset performance monitoring data
    PerformanceMonitoringMiddleware.resetStats();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getGlobalErrorRate', () => {
    it('should return 0 when no requests', () => {
      const errorRate = service.getGlobalErrorRate();
      expect(errorRate).toBe(0);
    });

    it('should calculate error rate correctly', () => {
      // Mock performance stats with errors
      const mockStats = {
        totalRequests: 100,
        errorRequests: 5,
        averageResponseTime: 200,
        slowRequests: 10,
        requestsPerSecond: 2.5,
        memoryTrend: [],
        topSlowEndpoints: [],
      };

      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue(mockStats);

      const errorRate = service.getGlobalErrorRate();
      expect(errorRate).toBe(5); // 5/100 * 100 = 5%
    });
  });

  describe('getEndpointErrorRates', () => {
    it('should return empty array when no detailed metrics', () => {
      const mockDetailedMetrics = {
        slowRequestThreshold: 1000,
        verySlowRequestThreshold: 3000,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        stats: {
          totalRequests: 0,
          errorRequests: 0,
          averageResponseTime: 0,
          slowRequests: 0,
          requestsPerSecond: 0,
          memoryTrend: [],
          topSlowEndpoints: [],
        },
        recentRequests: [],
        endpointStats: [],
      };

      vi.spyOn(PerformanceMonitoringMiddleware, 'getDetailedMetrics').mockReturnValue(
        mockDetailedMetrics,
      );

      const endpointErrorRates = service.getEndpointErrorRates();
      expect(endpointErrorRates).toEqual([]);
    });

    it('should calculate endpoint error rates with severity levels', () => {
      const mockDetailedMetrics = {
        slowRequestThreshold: 1000,
        verySlowRequestThreshold: 3000,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        stats: {
          totalRequests: 100,
          errorRequests: 10,
          averageResponseTime: 200,
          slowRequests: 5,
          requestsPerSecond: 2.5,
          memoryTrend: [],
          topSlowEndpoints: [],
        },
        recentRequests: [],
        endpointStats: [
          {
            endpoint: '/api/v2/articles',
            avgDuration: 200,
            count: 50,
            errorRate: 2, // 2% - normal
          },
          {
            endpoint: '/api/v2/users',
            avgDuration: 300,
            count: 30,
            errorRate: 8, // 8% - warning
          },
          {
            endpoint: '/api/v2/admin',
            avgDuration: 400,
            count: 20,
            errorRate: 15, // 15% - critical
          },
        ],
      };

      vi.spyOn(PerformanceMonitoringMiddleware, 'getDetailedMetrics').mockReturnValue(
        mockDetailedMetrics,
      );

      const endpointErrorRates = service.getEndpointErrorRates();

      expect(endpointErrorRates).toHaveLength(3);
      expect(endpointErrorRates[0].severity).toBe('critical');
      expect(endpointErrorRates[1].severity).toBe('warning');
      expect(endpointErrorRates[2].severity).toBe('normal');
    });
  });

  describe('getErrorRateAlerts', () => {
    it('should return empty array when no alerts', () => {
      const mockStats = {
        totalRequests: 100,
        errorRequests: 2, // 2% - below warning threshold
        averageResponseTime: 200,
        slowRequests: 5,
        requestsPerSecond: 2.5,
        memoryTrend: [],
        topSlowEndpoints: [],
      };

      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue(mockStats);
      vi.spyOn(service, 'getEndpointErrorRates').mockReturnValue([]);

      const alerts = service.getErrorRateAlerts();
      expect(alerts).toEqual([]);
    });

    it('should generate global error rate alerts', () => {
      const mockStats = {
        totalRequests: 100,
        errorRequests: 12, // 12% - critical
        averageResponseTime: 200,
        slowRequests: 5,
        requestsPerSecond: 2.5,
        memoryTrend: [],
        topSlowEndpoints: [],
      };

      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue(mockStats);
      vi.spyOn(service, 'getEndpointErrorRates').mockReturnValue([]);

      const alerts = service.getErrorRateAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('critical');
      expect(alerts[0].errorRate).toBe(12);
    });
  });

  describe('getSystemHealthStatus', () => {
    it('should return healthy status when error rate is low', () => {
      const mockStats = {
        totalRequests: 100,
        errorRequests: 2, // 2% - healthy
        averageResponseTime: 200,
        slowRequests: 5,
        requestsPerSecond: 2.5,
        memoryTrend: [],
        topSlowEndpoints: [],
      };

      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue(mockStats);
      vi.spyOn(service, 'getErrorRateAlerts').mockReturnValue([]);

      const health = service.getSystemHealthStatus();
      expect(health.status).toBe('healthy');
      expect(health.errorRate).toBe(2);
    });

    it('should return warning status when error rate is moderate', () => {
      const mockStats = {
        totalRequests: 100,
        errorRequests: 7, // 7% - warning
        averageResponseTime: 200,
        slowRequests: 5,
        requestsPerSecond: 2.5,
        memoryTrend: [],
        topSlowEndpoints: [],
      };

      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue(mockStats);
      vi.spyOn(service, 'getErrorRateAlerts').mockReturnValue([
        { type: 'warning', message: 'Test warning', errorRate: 7 },
      ]);

      const health = service.getSystemHealthStatus();
      expect(health.status).toBe('warning');
      expect(health.errorRate).toBeCloseTo(7, 1);
    });

    it('should return critical status when error rate is high', () => {
      const mockStats = {
        totalRequests: 100,
        errorRequests: 15, // 15% - critical
        averageResponseTime: 200,
        slowRequests: 5,
        requestsPerSecond: 2.5,
        memoryTrend: [],
        topSlowEndpoints: [],
      };

      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue(mockStats);
      vi.spyOn(service, 'getErrorRateAlerts').mockReturnValue([
        { type: 'critical', message: 'Test critical', errorRate: 15 },
      ]);

      const health = service.getSystemHealthStatus();
      expect(health.status).toBe('critical');
      expect(health.errorRate).toBe(15);
    });
  });

  describe('getErrorRateSummary', () => {
    it('should provide comprehensive error rate summary', () => {
      const mockStats = {
        totalRequests: 200,
        errorRequests: 10,
        averageResponseTime: 250,
        slowRequests: 15,
        requestsPerSecond: 3.2,
        memoryTrend: [],
        topSlowEndpoints: [],
      };

      const mockEndpointErrorRates = [
        {
          endpoint: '/api/v2/test1',
          errorRate: 8,
          errorCount: 4,
          totalRequests: 50,
          severity: 'warning' as const,
        },
        {
          endpoint: '/api/v2/test2',
          errorRate: 12,
          errorCount: 6,
          totalRequests: 50,
          severity: 'critical' as const,
        },
      ];

      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue(mockStats);
      vi.spyOn(service, 'getEndpointErrorRates').mockReturnValue(mockEndpointErrorRates);
      vi.spyOn(service, 'getErrorRateAlerts').mockReturnValue([
        { type: 'warning', message: 'Test warning', errorRate: 8 },
      ]);

      const summary = service.getErrorRateSummary();

      expect(summary.globalErrorRate).toBe(5); // 10/200 * 100
      expect(summary.totalErrors).toBe(10);
      expect(summary.totalRequests).toBe(200);
      expect(summary.highErrorEndpoints).toBe(2); // warning + critical endpoints
      expect(summary.criticalErrorEndpoints).toBe(1); // critical endpoints
      expect(summary.alertCount).toBe(1);
    });
  });
});
