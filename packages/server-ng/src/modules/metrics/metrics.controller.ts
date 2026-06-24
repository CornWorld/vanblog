import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PerformanceInterceptor } from '../../core/interceptors/performance.interceptor';
import { PerformanceMonitoringMiddleware } from '../../shared/middleware/performance-monitoring.middleware';
import { ErrorRateMonitoringService } from '../../shared/services/error-rate-monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Metrics')
@Controller({ path: 'metrics', version: '2' })
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(private readonly errorRateMonitoringService: ErrorRateMonitoringService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus format metrics',
    type: String,
  })
  getMetrics(): string {
    const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
    const performanceSummary = PerformanceInterceptor.getPerformanceSummary();
    const globalErrorRate = this.errorRateMonitoringService.getGlobalErrorRate();
    const endpointErrorRates = this.errorRateMonitoringService.getEndpointErrorRates();
    const healthStatus = this.errorRateMonitoringService.getSystemHealthStatus();

    const metrics: string[] = [];

    // HTTP request metrics
    metrics.push('# HELP http_requests_total Total number of HTTP requests');
    metrics.push('# TYPE http_requests_total counter');
    metrics.push(`http_requests_total ${String(stats.totalRequests)}`);

    // HTTP request duration
    metrics.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
    metrics.push('# TYPE http_request_duration_seconds histogram');
    metrics.push(
      `http_request_duration_seconds_sum ${String((stats.averageResponseTime * stats.totalRequests) / 1000)}`,
    );
    metrics.push(`http_request_duration_seconds_count ${String(stats.totalRequests)}`);

    // Response time distribution
    metrics.push('# HELP http_request_duration_distribution Response time distribution');
    metrics.push('# TYPE http_request_duration_distribution gauge');
    metrics.push(
      `http_request_duration_distribution{bucket="fast"} ${String(performanceSummary.responseTimeDistribution.fast)}`,
    );
    metrics.push(
      `http_request_duration_distribution{bucket="normal"} ${String(performanceSummary.responseTimeDistribution.normal)}`,
    );
    metrics.push(
      `http_request_duration_distribution{bucket="slow"} ${String(performanceSummary.responseTimeDistribution.slow)}`,
    );
    metrics.push(
      `http_request_duration_distribution{bucket="very_slow"} ${String(performanceSummary.responseTimeDistribution.verySlow)}`,
    );

    // Error rate metrics
    metrics.push('# HELP http_requests_error_rate HTTP request error rate');
    metrics.push('# TYPE http_requests_error_rate gauge');
    metrics.push(`http_requests_error_rate ${String(globalErrorRate)}`);

    metrics.push('# HELP http_requests_errors_total Total number of HTTP request errors');
    metrics.push('# TYPE http_requests_errors_total counter');
    metrics.push(`http_requests_errors_total ${String(stats.errorRequests)}`);

    // Slow request metrics
    metrics.push('# HELP http_requests_slow_total Total number of slow HTTP requests');
    metrics.push('# TYPE http_requests_slow_total counter');
    metrics.push(`http_requests_slow_total ${String(stats.slowRequests)}`);

    // Endpoint performance metrics
    metrics.push('# HELP http_endpoints_total Total number of monitored endpoints');
    metrics.push('# TYPE http_endpoints_total gauge');
    metrics.push(`http_endpoints_total ${String(performanceSummary.totalEndpoints)}`);

    metrics.push('# HELP http_endpoints_slow_total Total number of slow endpoints');
    metrics.push('# TYPE http_endpoints_slow_total gauge');
    metrics.push(`http_endpoints_slow_total ${String(performanceSummary.slowEndpoints)}`);

    // Memory usage
    const memoryUsage = process.memoryUsage();
    metrics.push('# HELP process_resident_memory_bytes Resident memory size in bytes');
    metrics.push('# TYPE process_resident_memory_bytes gauge');
    metrics.push(`process_resident_memory_bytes ${String(memoryUsage.rss)}`);

    metrics.push('# HELP process_heap_bytes Process heap size in bytes');
    metrics.push('# TYPE process_heap_bytes gauge');
    metrics.push(`process_heap_bytes ${String(memoryUsage.heapUsed)}`);

    // System health
    metrics.push('# HELP system_health_status System health status (1=healthy, 0=unhealthy)');
    metrics.push('# TYPE system_health_status gauge');
    metrics.push(`system_health_status ${String(healthStatus.status === 'healthy' ? 1 : 0)}`);

    // Endpoint-specific error rates
    endpointErrorRates.forEach((endpoint) => {
      metrics.push(
        `# HELP http_requests_error_rate_by_endpoint{path="${endpoint.endpoint}"} Error rate for specific endpoint`,
      );
      metrics.push(`# TYPE http_requests_error_rate_by_endpoint gauge`);
      metrics.push(
        `http_requests_error_rate_by_endpoint{path="${endpoint.endpoint}"} ${String(endpoint.errorRate)}`,
      );
    });

    return `${metrics.join('\n')}\n`;
  }

  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({
    status: 200,
    description: 'System health status',
  })
  getHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    errorRate: number;
  } {
    return this.errorRateMonitoringService.getSystemHealthStatus();
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get detailed performance metrics' })
  @ApiResponse({
    status: 200,
    description: 'Detailed performance metrics',
  })
  getPerformanceMetrics(): {
    performance: {
      totalEndpoints: number;
      slowEndpoints: number;
      averageResponseTime: number;
      totalRequests: number;
      responseTimeDistribution: {
        fast: number;
        normal: number;
        slow: number;
        verySlow: number;
      };
    };
    endpoints: Array<{
      endpoint: string;
      totalRequests: number;
      averageDuration: number;
      minDuration: number;
      maxDuration: number;
      responseTimeDistribution: {
        fast: number;
        normal: number;
        slow: number;
        verySlow: number;
      };
      lastUpdated: Date;
    }>;
    errorRates: {
      globalErrorRate: number;
      totalErrors: number;
      totalRequests: number;
      highErrorEndpoints: number;
      criticalErrorEndpoints: number;
      alertCount: number;
      performanceCorrelationAlerts: number;
      averageResponseTime: number;
      slowRequestRatio: number;
    };
    trends: {
      trend: 'improving' | 'stable' | 'degrading';
      recommendation: string;
      criticalEndpoints: string[];
      performanceImpactedEndpoints: string[];
    };
  } {
    const performanceSummary = PerformanceInterceptor.getPerformanceSummary();
    const endpointStats = PerformanceInterceptor.getEndpointStats();
    const errorRateSummary = this.errorRateMonitoringService.getErrorRateSummary();
    const trendAnalysis = this.errorRateMonitoringService.getErrorRateTrendAnalysis();

    return {
      performance: performanceSummary,
      endpoints: Array.from(endpointStats.entries()).map(([endpoint, stats]) => ({
        endpoint,
        ...stats,
      })),
      errorRates: errorRateSummary,
      trends: trendAnalysis,
    };
  }
}
