import { Injectable, Logger } from '@nestjs/common';

import { PerformanceMonitoringMiddleware } from '../middleware/performance-monitoring.middleware';

/**
 * 错误率监控服务
 *
 * Linus 式设计：简单直接，基于现有的性能监控中间件数据。
 * 不重复造轮子，复用已有的数据收集机制。
 *
 * 核心功能：
 * - 实时错误率计算
 * - 端点级别错误率统计
 * - 错误趋势分析
 * - 错误率阈值告警
 */
@Injectable()
export class ErrorRateMonitoringService {
  private readonly logger = new Logger(ErrorRateMonitoringService.name);

  // 错误率阈值配置
  private static readonly ERROR_RATE_WARNING_THRESHOLD = 5; // 5%
  private static readonly ERROR_RATE_CRITICAL_THRESHOLD = 10; // 10%
  private static readonly HIGH_ERROR_COUNT_THRESHOLD = 50; // 50个错误

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
   * 获取端点错误率统计
   *
   * @returns 按端点分组的错误率数据
   */
  getEndpointErrorRates(): Array<{
    endpoint: string;
    errorRate: number;
    errorCount: number;
    totalRequests: number;
    severity: 'normal' | 'warning' | 'critical';
  }> {
    const detailedMetrics = PerformanceMonitoringMiddleware.getDetailedMetrics();

    return detailedMetrics.endpointStats
      .map((stat) => {
        const errorCount = Math.round((stat.errorRate / 100) * stat.count);
        let severity: 'normal' | 'warning' | 'critical' = 'normal';

        if (stat.errorRate >= ErrorRateMonitoringService.ERROR_RATE_CRITICAL_THRESHOLD) {
          severity = 'critical';
        } else if (stat.errorRate >= ErrorRateMonitoringService.ERROR_RATE_WARNING_THRESHOLD) {
          severity = 'warning';
        }

        return {
          endpoint: stat.endpoint,
          errorRate: stat.errorRate,
          errorCount,
          totalRequests: stat.count,
          severity,
        };
      })
      .sort((a, b) => b.errorRate - a.errorRate);
  }

  /**
   * 获取错误率告警
   *
   * @returns 错误率相关的告警信息
   */
  getErrorRateAlerts(): Array<{
    type: 'warning' | 'critical';
    message: string;
    endpoint?: string;
    errorRate: number;
  }> {
    const alerts: Array<{
      type: 'warning' | 'critical';
      message: string;
      endpoint?: string;
      errorRate: number;
    }> = [];

    // 检查全局错误率
    const globalErrorRate = this.getGlobalErrorRate();
    if (globalErrorRate >= ErrorRateMonitoringService.ERROR_RATE_CRITICAL_THRESHOLD) {
      alerts.push({
        type: 'critical',
        message: `Critical global error rate: ${globalErrorRate.toFixed(1)}%`,
        errorRate: globalErrorRate,
      });
    } else if (globalErrorRate >= ErrorRateMonitoringService.ERROR_RATE_WARNING_THRESHOLD) {
      alerts.push({
        type: 'warning',
        message: `High global error rate: ${globalErrorRate.toFixed(1)}%`,
        errorRate: globalErrorRate,
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
        });
      } else if (stat.severity === 'warning') {
        alerts.push({
          type: 'warning',
          message: `High error rate for ${stat.endpoint}: ${stat.errorRate.toFixed(1)}%`,
          endpoint: stat.endpoint,
          errorRate: stat.errorRate,
        });
      }

      // 检查错误数量
      if (stat.errorCount >= ErrorRateMonitoringService.HIGH_ERROR_COUNT_THRESHOLD) {
        alerts.push({
          type: 'warning',
          message: `High error count for ${stat.endpoint}: ${stat.errorCount} errors`,
          endpoint: stat.endpoint,
          errorRate: stat.errorRate,
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
      if (alert.type === 'critical') {
        this.logger.error(alert.message);
      } else {
        this.logger.warn(alert.message);
      }
    }
  }

  /**
   * 获取错误率摘要
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
  } {
    const stats = PerformanceMonitoringMiddleware.getPerformanceStats();
    const endpointStats = this.getEndpointErrorRates();
    const alerts = this.getErrorRateAlerts();

    const highErrorEndpoints = endpointStats.filter(
      (stat) => stat.severity === 'warning' || stat.severity === 'critical',
    ).length;

    const criticalErrorEndpoints = endpointStats.filter(
      (stat) => stat.severity === 'critical',
    ).length;

    return {
      globalErrorRate: this.getGlobalErrorRate(),
      totalErrors: stats.errorRequests,
      totalRequests: stats.totalRequests,
      highErrorEndpoints,
      criticalErrorEndpoints,
      alertCount: alerts.length,
    };
  }

  /**
   * 检查系统健康状态
   *
   * @returns 基于错误率的系统健康状态
   */
  getSystemHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    errorRate: number;
  } {
    const globalErrorRate = this.getGlobalErrorRate();
    const alerts = this.getErrorRateAlerts();

    if (alerts.some((alert) => alert.type === 'critical')) {
      return {
        status: 'critical',
        message: 'System has critical error rates',
        errorRate: globalErrorRate,
      };
    }

    if (alerts.some((alert) => alert.type === 'warning')) {
      return {
        status: 'warning',
        message: 'System has elevated error rates',
        errorRate: globalErrorRate,
      };
    }

    return {
      status: 'healthy',
      message: 'System error rates are within normal range',
      errorRate: globalErrorRate,
    };
  }
}
