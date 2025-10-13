import { Test, type TestingModule } from '@nestjs/testing';

import { PerformanceMonitoringMiddleware } from '../../shared/middleware/performance-monitoring.middleware';
import { ErrorRateMonitoringService } from '../../shared/services/error-rate-monitoring.service';

import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  let controller: MetricsController;
  let errorRateMonitoringService: ErrorRateMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: ErrorRateMonitoringService,
          useValue: {
            getGlobalErrorRate: vi.fn(),
            getEndpointErrorRates: vi.fn(),
            getSystemHealthStatus: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    errorRateMonitoringService = module.get<ErrorRateMonitoringService>(ErrorRateMonitoringService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should return Prometheus format metrics', () => {
      // Mock the static method
      const mockStats = {
        totalRequests: 100,
        errorRequests: 5,
        slowRequests: 10,
        averageResponseTime: 250,
        requestsPerSecond: 2.5,
        memoryTrend: [100, 110, 105],
        topSlowEndpoints: [{ path: '/api/v2/articles', avgDuration: 500, count: 20 }],
      };

      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue(mockStats);

      vi.spyOn(errorRateMonitoringService, 'getGlobalErrorRate').mockReturnValue(5.0);
      vi.spyOn(errorRateMonitoringService, 'getEndpointErrorRates').mockReturnValue([
        {
          endpoint: '/api/v2/articles',
          errorRate: 2.5,
          errorCount: 2,
          totalRequests: 80,
          severity: 'normal' as const,
          averageResponseTime: 150,
          slowRequestRatio: 0.1,
          errorResponseTimeCorrelation: 'low' as const,
        },
      ]);
      vi.spyOn(errorRateMonitoringService, 'getSystemHealthStatus').mockReturnValue({
        status: 'healthy',
        message: 'System is healthy',
        errorRate: 5.0,
        factors: [],
      });

      const result = controller.getMetrics();

      expect(result).toContain('http_requests_total 100');
      expect(result).toContain('http_requests_error_rate 5');
      expect(result).toContain('http_requests_errors_total 5');
      expect(result).toContain('system_health_status 1');
      expect(result).toContain('http_requests_error_rate_by_endpoint{path="/api/v2/articles"} 2.5');
    });
  });

  describe('getHealth', () => {
    it('should return system health status', () => {
      const mockHealthStatus = {
        status: 'healthy' as const,
        message: 'System is healthy',
        errorRate: 2.5,
        factors: [],
      };

      vi.spyOn(errorRateMonitoringService, 'getSystemHealthStatus').mockReturnValue(
        mockHealthStatus,
      );

      const result = controller.getHealth();

      expect(result).toEqual(mockHealthStatus);
      expect(errorRateMonitoringService.getSystemHealthStatus).toHaveBeenCalled();
    });
  });
});
