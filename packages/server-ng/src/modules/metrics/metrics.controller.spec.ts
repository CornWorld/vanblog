import { Test, type TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';

import { PerformanceMonitoringMiddleware } from '../../shared/middleware/performance-monitoring.middleware';
import { ErrorRateMonitoringService } from '../../shared/services/error-rate-monitoring.service';
import { MockUtils } from '../../../test/mock-utils';

import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  let controller: MetricsController;
  let errorRateMonitoringService: ErrorRateMonitoringService;

  beforeEach(async () => {
    const mockErrorRateService = MockUtils.services.createErrorRateMonitoringServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: ErrorRateMonitoringService,
          useValue: mockErrorRateService,
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
      const mockStats = MockUtils.testData.createPerformanceStats();

      vi.spyOn(PerformanceMonitoringMiddleware, 'getPerformanceStats').mockReturnValue(
        mockStats as any,
      );

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
      vi.spyOn(errorRateMonitoringService, 'getSystemHealthStatus').mockReturnValue(
        MockUtils.testData.createHealthStatus() as any,
      );

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
      const mockHealthStatus = MockUtils.testData.createHealthStatus();

      vi.spyOn(errorRateMonitoringService, 'getSystemHealthStatus').mockReturnValue(
        mockHealthStatus as any,
      );

      const result = controller.getHealth();

      expect(result).toEqual(mockHealthStatus);
      expect(errorRateMonitoringService.getSystemHealthStatus).toHaveBeenCalled();
    });
  });
});
