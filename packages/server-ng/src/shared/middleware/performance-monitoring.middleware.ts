import { Injectable, NestMiddleware, Logger } from '@nestjs/common';

import type { Request, Response, NextFunction } from 'express';

/**
 * 请求性能指标
 */
interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  ip: string;
  userAgent: string;
}

/**
 * 性能统计
 */
interface PerformanceStats {
  totalRequests: number;
  averageResponseTime: number;
  slowRequests: number;
  errorRequests: number;
  requestsPerSecond: number;
  memoryTrend: number[];
  topSlowEndpoints: Array<{ path: string; avgDuration: number; count: number }>;
}

@Injectable()
export class PerformanceMonitoringMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMonitoringMiddleware.name);

  // 静态存储，用于收集全局性能指标
  private static readonly requestMetrics: RequestMetrics[] = [];
  private static readonly endpointStats = new Map<
    string,
    { totalDuration: number; count: number; errors: number }
  >();
  private static readonly memorySnapshots: number[] = [];
  private static startTime = Date.now();

  // 配置项
  private static readonly MAX_METRICS_HISTORY = 1000; // 最多保存1000条请求记录
  private static readonly MAX_MEMORY_SNAPSHOTS = 100; // 最多保存100个内存快照
  private static readonly MEMORY_SNAPSHOT_INTERVAL = 30000; // 30秒记录一次内存快照

  private static lastMemorySnapshot = 0;

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl } = req;

    // 记录内存快照（定期）
    this.recordMemorySnapshot();

    // Log request start for very verbose debugging (optional)
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`[${method}] ${originalUrl} - Started`);
    }

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const requestIp = req.ip ?? 'unknown';

      // 记录内存快照
      this.recordMemorySnapshot();

      // 收集性能指标
      const metrics: RequestMetrics = {
        timestamp: new Date(startTime),
        method,
        path: originalUrl,
        statusCode,
        duration,
        memoryUsage: process.memoryUsage(),
        ip: requestIp,
        userAgent: req.get('User-Agent') ?? 'Unknown',
      };
      PerformanceMonitoringMiddleware.collectMetrics(metrics);

      // 记录日志
      if (duration > 3000) {
        this.logger.warn(
          `Very slow request: ${method} ${originalUrl} - ${duration}ms (Status: ${statusCode}, IP: ${requestIp}, UA: ${req.get('User-Agent') ?? 'Unknown'})`,
        );
      } else if (duration > 1000) {
        this.logger.warn(
          `Slow request: ${method} ${originalUrl} - ${duration}ms (Status: ${statusCode}, IP: ${requestIp})`,
        );
      } else {
        this.logger.log(`${method} ${originalUrl} - ${duration}ms (Status: ${statusCode})`);
      }
    });

    next();
  }

  /**
   * 记录内存快照
   */
  private recordMemorySnapshot(): void {
    const now = Date.now();
    if (
      now - PerformanceMonitoringMiddleware.lastMemorySnapshot >
      PerformanceMonitoringMiddleware.MEMORY_SNAPSHOT_INTERVAL
    ) {
      const memoryUsage = process.memoryUsage();
      PerformanceMonitoringMiddleware.memorySnapshots.push(memoryUsage.heapUsed);

      // 保持数组大小在限制内
      if (
        PerformanceMonitoringMiddleware.memorySnapshots.length >
        PerformanceMonitoringMiddleware.MAX_MEMORY_SNAPSHOTS
      ) {
        PerformanceMonitoringMiddleware.memorySnapshots.shift();
      }

      PerformanceMonitoringMiddleware.lastMemorySnapshot = now;
    }
  }

  /**
   * 收集请求指标
   */
  private static collectMetrics(metrics: RequestMetrics): void {
    // 添加到历史记录
    this.requestMetrics.push(metrics);

    // 保持历史记录在限制内
    if (this.requestMetrics.length > this.MAX_METRICS_HISTORY) {
      this.requestMetrics.shift();
    }

    // 更新端点统计
    const endpointKey = `${metrics.method} ${metrics.path}`;
    const existing = this.endpointStats.get(endpointKey);

    if (existing) {
      existing.totalDuration += metrics.duration;
      existing.count += 1;
      if (metrics.statusCode >= 400) {
        existing.errors += 1;
      }
    } else {
      this.endpointStats.set(endpointKey, {
        totalDuration: metrics.duration,
        count: 1,
        errors: metrics.statusCode >= 400 ? 1 : 0,
      });
    }
  }

  /**
   * 获取性能统计
   */
  static getPerformanceStats(): PerformanceStats {
    const now = Date.now();
    const uptimeSeconds = (now - this.startTime) / 1000;

    const totalRequests = this.requestMetrics.length;
    const totalDuration = this.requestMetrics.reduce((sum, m) => sum + m.duration, 0);
    const slowRequests = this.requestMetrics.filter((m) => m.duration > 1000).length;
    const errorRequests = this.requestMetrics.filter((m) => m.statusCode >= 400).length;

    // 计算最慢的端点
    const topSlowEndpoints = Array.from(this.endpointStats.entries())
      .map(([path, stats]) => ({
        path,
        avgDuration: stats.totalDuration / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    return {
      totalRequests,
      averageResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
      slowRequests,
      errorRequests,
      requestsPerSecond: totalRequests / uptimeSeconds,
      memoryTrend: [...this.memorySnapshots],
      topSlowEndpoints,
    };
  }

  /**
   * 获取详细的性能指标
   */
  static getDetailedMetrics(): {
    slowRequestThreshold: number;
    verySlowRequestThreshold: number;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    stats: PerformanceStats;
    recentRequests: RequestMetrics[];
    endpointStats: Array<{
      endpoint: string;
      avgDuration: number;
      count: number;
      errorRate: number;
    }>;
  } {
    const stats = this.getPerformanceStats();
    const recentRequests = this.requestMetrics.slice(-50); // 最近50个请求

    const endpointStats = Array.from(this.endpointStats.entries()).map(([endpoint, data]) => ({
      endpoint,
      avgDuration: data.totalDuration / data.count,
      count: data.count,
      errorRate: (data.errors / data.count) * 100,
    }));

    return {
      slowRequestThreshold: 1000,
      verySlowRequestThreshold: 3000,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      stats,
      recentRequests,
      endpointStats,
    };
  }

  /**
   * 重置性能统计
   */
  static resetStats(): void {
    this.requestMetrics.length = 0;
    this.endpointStats.clear();
    this.memorySnapshots.length = 0;
    this.startTime = Date.now();
    this.lastMemorySnapshot = 0;
  }

  /**
   * 获取内存使用趋势
   */
  static getMemoryTrend(): {
    current: number;
    trend: number[];
    average: number;
    peak: number;
    isIncreasing: boolean;
  } {
    const current = process.memoryUsage().heapUsed;
    const trend = [...this.memorySnapshots];
    const average =
      trend.length > 0 ? trend.reduce((sum, val) => sum + val, 0) / trend.length : current;
    const peak = Math.max(...trend, current);

    // 判断是否呈上升趋势（比较最近25%和前面75%的平均值）
    const recentCount = Math.max(1, Math.floor(trend.length * 0.25));
    const recentAvg = trend.slice(-recentCount).reduce((sum, val) => sum + val, 0) / recentCount;
    const earlierAvg =
      trend.slice(0, -recentCount).reduce((sum, val) => sum + val, 0) /
      Math.max(1, trend.length - recentCount);
    const isIncreasing = recentAvg > earlierAvg * 1.1; // 10%以上增长认为是上升趋势

    return {
      current,
      trend,
      average,
      peak,
      isIncreasing,
    };
  }

  /**
   * 获取性能警告
   */
  static getPerformanceWarnings(): string[] {
    const warnings: string[] = [];
    const stats = this.getPerformanceStats();
    const memoryTrend = this.getMemoryTrend();

    // 检查平均响应时间
    if (stats.averageResponseTime > 2000) {
      warnings.push(`High average response time: ${Math.round(stats.averageResponseTime)}ms`);
    }

    // 检查错误率
    const errorRate = (stats.errorRequests / stats.totalRequests) * 100;
    if (errorRate > 5) {
      warnings.push(`High error rate: ${errorRate.toFixed(1)}%`);
    }

    // 检查慢请求比例
    const slowRequestRate = (stats.slowRequests / stats.totalRequests) * 100;
    if (slowRequestRate > 10) {
      warnings.push(`High slow request rate: ${slowRequestRate.toFixed(1)}%`);
    }

    // 检查内存使用
    const memoryUsageMB = memoryTrend.current / 1024 / 1024;
    if (memoryUsageMB > 500) {
      warnings.push(`High memory usage: ${Math.round(memoryUsageMB)}MB`);
    }

    if (memoryTrend.isIncreasing) {
      warnings.push('Memory usage is trending upward - possible memory leak');
    }

    return warnings;
  }

  /**
   * 向后兼容的方法
   */
  static getPerformanceMetrics(): {
    slowRequestThreshold: number;
    verySlowRequestThreshold: number;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  } {
    return {
      slowRequestThreshold: 1000,
      verySlowRequestThreshold: 3000,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}
