import { Injectable, Logger } from '@nestjs/common';

import { PerformanceInterceptor } from '../../core/interceptors/performance.interceptor';
import { PerformanceMonitoringMiddleware } from '../middleware/performance-monitoring.middleware';

/**
 * 错误率监控服务
 *
 * Linus 式设计：简单直接，基于现有的性能监控中间件和拦截器数据。
 * 不重复造轮子，复用已有的数据收集机制。
 *
 * 核心功能：
 * - 实时错误率计算
 * - 端点级别错误率统计
 * - 错误趋势分析
 * - 错误率阈值告警
 * - 响应时间与错误率关联分析
 */
@Injectable()
export class ErrorRateMonitoringService {
  private readonly logger = new Logger(ErrorRateMonitoringService.name);

  // 错误率阈值配置
  private static readonly ERROR_RATE_WARNING_THRESHOLD = 5; // 5%
  private static readonly ERROR_RATE_CRITICAL_THRESHOLD = 10; // 10%
  private static readonly HIGH_ERROR_COUNT_THRESHOLD = 50; // 50个错误
  private static readonly SLOW_REQUEST_ERROR_CORRELATION_THRESHOLD = 0.7; // 70%

  /**
   * 获取全局错误率
   *
   * @returns 全局错误率百分比
   */
  getGlobalErrorRate(): number {
    const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
    if (stats.totalRequests === 0) return 0;

    return (stats.errorRequests / stats.totalRequests) * 100;
  }

  /**
   * 获取端点错误率统计（增强版，包含响应时间分析）
   *
   * @returns 按端点分组的错误率数据
   */
  getEndpointErrorRates(): Array<{
    endpoint: string;
    errorRate: number;
    errorCount: number;
    totalRequests: number;
    severity: 'normal' | 'warning' | 'critical';
    averageResponseTime: number;
    slowRequestRatio: number;
    errorResponseTimeCorrelation: 'high' | 'medium' | 'low';
  }> {
    const detailedMetrics = PerformanceMonitoringMiddleware.getDetailedMetrics();
    const interceptorStats = PerformanceInterceptor.getEndpointStats();

    return detailedMetrics.endpointStats
      .map((stat) => {
        const errorCount = Math.round((stat.errorRate / 100) * stat.count);
        let severity: 'normal' | 'warning' | 'critical' = 'normal';

        if (stat.errorRate >= ErrorRateMonitoringService.ERROR_RATE_CRITICAL_THRESHOLD) {
          severity = 'critical';
        } else if (stat.errorRate >= ErrorRateMonitoringService.ERROR_RATE_WARNING_THRESHOLD) {
          severity = 'warning';
        }

        // 从拦截器获取响应时间数据
        const interceptorStat = interceptorStats.get(stat.endpoint);
        const averageResponseTime = interceptorStat?.averageDuration ?? 0;
        const slowRequestRatio = interceptorStat
          ? (interceptorStat.responseTimeDistribution.slow +
              interceptorStat.responseTimeDistribution.verySlow) /
            interceptorStat.totalRequests
          : 0;

        // 分析错误率与响应时间的关联性
        let errorResponseTimeCorrelation: 'high' | 'medium' | 'low' = 'low';
        if (
          slowRequestRatio > ErrorRateMonitoringService.SLOW_REQUEST_ERROR_CORRELATION_THRESHOLD &&
          stat.errorRate > 0
        ) {
          errorResponseTimeCorrelation = 'high';
        } else if (slowRequestRatio > 0.3 && stat.errorRate > 0) {
          errorResponseTimeCorrelation = 'medium';
        }

        return {
          endpoint: stat.endpoint,
          errorRate: stat.errorRate,
          errorCount,
          totalRequests: stat.count,
          severity,
          averageResponseTime,
          slowRequestRatio: slowRequestRatio * 100, // 转换为百分比
          errorResponseTimeCorrelation,
        };
      })
      .sort((a, b) => b.errorRate - a.errorRate);
  }

  /**
   * 获取错误率告警（增强版，包含性能关联分析）
   *
   * @returns 错误率相关的告警信息
   */
  getErrorRateAlerts(): Array<{
    type: 'warning' | 'critical';
    message: string;
    endpoint?: string;
    errorRate: number;
    category: 'error_rate' | 'error_count' | 'performance_correlation';
  }> {
    const alerts: Array<{
      type: 'warning' | 'critical';
      message: string;
      endpoint?: string;
      errorRate: number;
      category: 'error_rate' | 'error_count' | 'performance_correlation';
    }> = [];

    // 检查全局错误率
    const globalErrorRate = this.getGlobalErrorRate();
    if (globalErrorRate >= ErrorRateMonitoringService.ERROR_RATE_CRITICAL_THRESHOLD) {
      alerts.push({
        type: 'critical',
        message: `Critical global error rate: ${globalErrorRate.toFixed(1)}%`,
        errorRate: globalErrorRate,
        category: 'error_rate',
      });
    } else if (globalErrorRate >= ErrorRateMonitoringService.ERROR_RATE_WARNING_THRESHOLD) {
      alerts.push({
        type: 'warning',
        message: `High global error rate: ${globalErrorRate.toFixed(1)}%`,
        errorRate: globalErrorRate,
        category: 'error_rate',
      });
    }

    // 检查端点错误率
    const endpointStats = this.getEndpointErrorRates();
    for (const stat of endpointStats) {
      if (stat.severity === 'critical') {
        alerts.push({
          type: 'critical',
          message: `Critical error rate for ${stat.endpoint}: ${stat.errorRate.toFixed(1)}%`,
          endpoint: stat.endpoint,
          errorRate: stat.errorRate,
          category: 'error_rate',
        });
      } else if (stat.severity === 'warning') {
        alerts.push({
          type: 'warning',
          message: `High error rate for ${stat.endpoint}: ${stat.errorRate.toFixed(1)}%`,
          endpoint: stat.endpoint,
          errorRate: stat.errorRate,
          category: 'error_rate',
        });
      }

      // 检查错误数量
      if (stat.errorCount >= ErrorRateMonitoringService.HIGH_ERROR_COUNT_THRESHOLD) {
        alerts.push({
          type: 'warning',
          message: `High error count for ${stat.endpoint}: ${stat.errorCount} errors`,
          endpoint: stat.endpoint,
          errorRate: stat.errorRate,
          category: 'error_count',
        });
      }

      // 检查错误率与性能的关联性
      if (stat.errorResponseTimeCorrelation === 'high' && stat.errorRate > 0) {
        alerts.push({
          type: 'warning',
          message: `High correlation between slow requests and errors for ${stat.endpoint}: ${stat.slowRequestRatio.toFixed(1)}% slow requests, ${stat.errorRate.toFixed(1)}% error rate`,
          endpoint: stat.endpoint,
          errorRate: stat.errorRate,
          category: 'performance_correlation',
        });
      }
    }

    return alerts;
  }

  /**
   * 记录错误率告警到日志
   */
  logErrorRateAlerts(): void {
    const alerts = this.getErrorRateAlerts();

    for (const alert of alerts) {
      const logMessage = `[${alert.category.toUpperCase()}] ${alert.message}`;

      if (alert.type === 'critical') {
        this.logger.error(logMessage);
      } else {
        this.logger.warn(logMessage);
      }
    }
  }

  /**
   * 获取错误率摘要（增强版，包含性能指标）
   *
   * @returns 错误率监控摘要信息
   */
  getErrorRateSummary(): {
    globalErrorRate: number;
    totalErrors: number;
    totalRequests: number;
    highErrorEndpoints: number;
    criticalErrorEndpoints: number;
    alertCount: number;
    performanceCorrelationAlerts: number;
    averageResponseTime: number;
    slowRequestRatio: number;
  } {
    const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
    const endpointStats = this.getEndpointErrorRates();
    const alerts = this.getErrorRateAlerts();
    const performanceSummary = PerformanceInterceptor.getPerformanceSummary();

    const highErrorEndpoints = endpointStats.filter(
      (stat) => stat.severity === 'warning' || stat.severity === 'critical',
    ).length;

    const criticalErrorEndpoints = endpointStats.filter(
      (stat) => stat.severity === 'critical',
    ).length;

    const performanceCorrelationAlerts = alerts.filter(
      (alert) => alert.category === 'performance_correlation',
    ).length;

    return {
      globalErrorRate: this.getGlobalErrorRate(),
      totalErrors: stats.errorRequests,
      totalRequests: stats.totalRequests,
      highErrorEndpoints,
      criticalErrorEndpoints,
      alertCount: alerts.length,
      performanceCorrelationAlerts,
      averageResponseTime: performanceSummary.averageResponseTime,
      slowRequestRatio:
        ((performanceSummary.responseTimeDistribution.slow +
          performanceSummary.responseTimeDistribution.verySlow) /
          Math.max(performanceSummary.totalRequests, 1)) *
        100,
    };
  }

  /**
   * 检查系统健康状态（增强版，考虑性能因素）
   *
   * @returns 基于错误率和性能的系统健康状态
   */
  getSystemHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    errorRate: number;
    factors: string[];
  } {
    const globalErrorRate = this.getGlobalErrorRate();
    const alerts = this.getErrorRateAlerts();
    const summary = this.getErrorRateSummary();
    const factors: string[] = [];

    if (alerts.some((alert) => alert.type === 'critical')) {
      if (globalErrorRate >= ErrorRateMonitoringService.ERROR_RATE_CRITICAL_THRESHOLD) {
        factors.push(`Critical global error rate: ${globalErrorRate.toFixed(1)}%`);
      }
      if (summary.criticalErrorEndpoints > 0) {
        factors.push(`${summary.criticalErrorEndpoints} endpoints with critical error rates`);
      }

      return {
        status: 'critical',
        message: 'System has critical error rates',
        errorRate: globalErrorRate,
        factors,
      };
    }

    if (alerts.some((alert) => alert.type === 'warning')) {
      if (globalErrorRate >= ErrorRateMonitoringService.ERROR_RATE_WARNING_THRESHOLD) {
        factors.push(`Elevated global error rate: ${globalErrorRate.toFixed(1)}%`);
      }
      if (summary.highErrorEndpoints > 0) {
        factors.push(`${summary.highErrorEndpoints} endpoints with high error rates`);
      }
      if (summary.performanceCorrelationAlerts > 0) {
        factors.push(
          `${summary.performanceCorrelationAlerts} endpoints with performance-error correlation`,
        );
      }
      if (summary.slowRequestRatio > 20) {
        factors.push(`High slow request ratio: ${summary.slowRequestRatio.toFixed(1)}%`);
      }

      return {
        status: 'warning',
        message: 'System has elevated error rates or performance issues',
        errorRate: globalErrorRate,
        factors,
      };
    }

    factors.push('All error rates within normal range');
    factors.push(`Average response time: ${summary.averageResponseTime.toFixed(0)}ms`);

    return {
      status: 'healthy',
      message: 'System error rates and performance are within normal range',
      errorRate: globalErrorRate,
      factors,
    };
  }

  /**
   * 获取错误率趋势分析
   *
   * @returns 错误率趋势和建议
   */
  getErrorRateTrendAnalysis(): {
    trend: 'improving' | 'stable' | 'degrading';
    recommendation: string;
    criticalEndpoints: string[];
    performanceImpactedEndpoints: string[];
  } {
    const endpointStats = this.getEndpointErrorRates();
    const criticalEndpoints = endpointStats
      .filter((stat) => stat.severity === 'critical')
      .map((stat) => stat.endpoint);

    const performanceImpactedEndpoints = endpointStats
      .filter((stat) => stat.errorResponseTimeCorrelation === 'high')
      .map((stat) => stat.endpoint);

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    let recommendation = 'Continue monitoring system performance and error rates.';

    if (criticalEndpoints.length > 0) {
      trend = 'degrading';
      recommendation = `Immediate attention required for ${criticalEndpoints.length} critical endpoints. Focus on: ${criticalEndpoints.slice(0, 3).join(', ')}.`;
    } else if (performanceImpactedEndpoints.length > 0) {
      trend = 'degrading';
      recommendation = `Performance optimization needed for ${performanceImpactedEndpoints.length} endpoints with high error-performance correlation.`;
    } else if (this.getGlobalErrorRate() < 1) {
      trend = 'improving';
      recommendation =
        'System is performing well. Maintain current monitoring and optimization practices.';
    }

    return {
      trend,
      recommendation,
      criticalEndpoints,
      performanceImpactedEndpoints,
    };
  }
}
