import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { nowIsoTz, dayjs } from '@vanblog/shared/runtime';

import type { Request, Response, NextFunction } from 'express';

/**
 * 请求性能指标
 *
 * 记录单个请求的详细性能数据，用于性能分析和监控。
 */
interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  /** ISO 8601 timestamp string */
  timestamp: string;
  memoryUsage: NodeJS.MemoryUsage;
  ip: string;
  userAgent: string;
}

/**
 * 性能统计
 *
 * 聚合的性能统计数据，提供系统整体性能概览。
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

/**
 * 性能监控中间件
 *
 * Linus 式设计：简单直接的性能监控，无复杂配置。
 *
 * 核心功能：
 * - 自动记录每个请求的响应时间和内存使用
 * - 识别慢请求和错误请求
 * - 提供端点级别的性能统计
 * - 内存使用趋势监控
 * - 性能警告和建议
 *
 * 设计原则：
 * - 低开销：监控本身不应显著影响性能
 * - 零配置：开箱即用，无需复杂设置
 * - 实用性：提供可操作的性能洞察
 */
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
  private static startTime = nowIsoTz();

  // 配置项
  private static readonly MAX_METRICS_HISTORY = 1000; // 最多保存1000条请求记录
  private static readonly MAX_MEMORY_SNAPSHOTS = 100; // 最多保存100个内存快照
  private static readonly MEMORY_SNAPSHOT_INTERVAL = 30000; // 30秒记录一次内存快照

  private static lastMemorySnapshot = nowIsoTz();

  /**
   * 中间件处理函数
   *
   * 在请求开始时记录时间戳，在响应结束时计算性能指标。
   * 自动收集响应时间、内存使用、状态码等关键指标。
   *
   * @param req Express 请求对象
   * @param res Express 响应对象
   * @param next 下一个中间件函数
   */
  use(req: Request, res: Response, next: NextFunction): void {
    const startTimeStr = nowIsoTz();
    const { method, originalUrl } = req;

    // 记录内存快照（定期）
    this.recordMemorySnapshot();

    // Log request start for very verbose debugging (optional)
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`[${method}] ${originalUrl} - Started`);
    }

    res.on('finish', () => {
      const duration = dayjs().diff(dayjs(startTimeStr), 'millisecond');
      const { statusCode } = res;
      const requestIp = req.ip ?? 'unknown';

      // 记录内存快照
      this.recordMemorySnapshot();

      // 收集性能指标
      const metrics: RequestMetrics = {
        timestamp: startTimeStr,
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
          `Very slow request: ${method} ${originalUrl} - ${String(duration)}ms (Status: ${String(statusCode)}, IP: ${requestIp}, UA: ${req.get('User-Agent') ?? 'Unknown'})`,
        );
      } else if (duration > 1000) {
        this.logger.warn(
          `Slow request: ${method} ${originalUrl} - ${String(duration)}ms (Status: ${String(statusCode)}, IP: ${requestIp})`,
        );
      } else {
        this.logger.log(
          `${method} ${originalUrl} - ${String(duration)}ms (Status: ${String(statusCode)})`,
        );
      }
    });

    next();
  }

  /**
   * 记录内存快照
   *
   * 定期记录内存使用情况，用于内存泄漏检测和趋势分析。
   * 采用固定间隔采样，避免过度频繁的内存检查。
   */
  private recordMemorySnapshot(): void {
    const now = nowIsoTz();
    const diff = dayjs(now).diff(
      dayjs(PerformanceMonitoringMiddleware.lastMemorySnapshot),
      'millisecond',
    );

    if (diff > PerformanceMonitoringMiddleware.MEMORY_SNAPSHOT_INTERVAL) {
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
   * 收集性能指标
   *
   * 将单个请求的性能数据添加到全局统计中。
   * 自动维护历史记录大小，防止内存无限增长。
   *
   * @param metrics 请求性能指标
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
   *
   * 计算并返回系统的整体性能统计数据。
   * 包括平均响应时间、请求量、错误率等关键指标。
   *
   * @returns 性能统计数据
   */
  static getPerformanceStats(): PerformanceStats {
    const now = nowIsoTz();
    const uptimeSeconds = dayjs(now).diff(dayjs(this.startTime), 'second');

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
   * 获取详细性能指标
   *
   * 返回完整的性能监控数据，包括统计信息、最近请求记录、
   * 端点统计和系统资源使用情况。用于性能分析和调试。
   *
   * @returns 详细的性能指标数据
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
   * 重置统计数据
   *
   * 清空所有性能统计数据，重新开始监控。
   * 用于系统重启后的数据清理或调试目的。
   */
  static resetStats(): void {
    this.requestMetrics.length = 0;
    this.endpointStats.clear();
    this.memorySnapshots.length = 0;
    this.startTime = nowIsoTz();
    this.lastMemorySnapshot = nowIsoTz();
  }

  /**
   * 获取内存使用趋势
   *
   * 分析内存使用的历史数据，识别内存泄漏和使用模式。
   * 提供当前使用量、趋势数据、平均值和峰值等信息。
   *
   * @returns 内存趋势分析数据
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
   *
   * 基于当前性能数据生成警告信息。
   * 自动识别高响应时间、高错误率、内存泄漏等问题。
   *
   * @returns 性能警告列表
   */
  static getPerformanceWarnings(): string[] {
    const warnings: string[] = [];
    const stats = this.getPerformanceStats();
    const memoryTrend = this.getMemoryTrend();

    // 检查平均响应时间
    if (stats.averageResponseTime > 2000) {
      warnings.push(
        `High average response time: ${String(Math.round(stats.averageResponseTime))}ms`,
      );
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
      warnings.push(`High memory usage: ${String(Math.round(memoryUsageMB))}MB`);
    }

    if (memoryTrend.isIncreasing) {
      warnings.push('Memory usage is trending upward - possible memory leak');
    }

    return warnings;
  }

  /**
   * 获取基础性能指标
   *
   * 返回系统的基础性能指标，包括响应时间阈值、
   * 内存使用和系统运行时间等核心数据。
   *
   * @returns 基础性能指标
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
