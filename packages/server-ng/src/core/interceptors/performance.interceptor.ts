import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { LoggerService } from '../logger/logger.service';

import type { Request, Response } from 'express';

/**
 * 响应时间分布统计
 */
interface ResponseTimeStats {
  fast: number; // < 100ms
  normal: number; // 100ms - 500ms
  slow: number; // 500ms - 1000ms
  verySlow: number; // > 1000ms
}

/**
 * 端点性能统计
 */
interface EndpointPerformanceStats {
  totalRequests: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  averageDuration: number;
  responseTimeDistribution: ResponseTimeStats;
  lastUpdated: Date;
}

/**
 * Linus 式性能监控拦截器 - 简单、直接、零特殊情况
 *
 * 核心原则：
 * 1. 记录每个请求的响应时间
 * 2. 识别慢请求并记录警告
 * 3. 提供端点级别的性能统计
 * 4. 零配置，自动处理所有请求
 * 5. 不破坏任何现有功能
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private static readonly SLOW_REQUEST_THRESHOLD = 1000; // 1秒
  private static readonly VERY_SLOW_REQUEST_THRESHOLD = 3000; // 3秒

  // 端点性能统计存储
  private static readonly endpointStats = new Map<string, EndpointPerformanceStats>();
  private static readonly MAX_ENDPOINTS = 1000; // 最多跟踪1000个端点

  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const startTime = Date.now();
    const { method, url, ip, socket, headers } = request;
    const userAgent = headers['user-agent'] ?? 'unknown';
    const clientIp = ip ?? socket.remoteAddress ?? 'unknown';
    const endpointKey = `${method} ${url}`;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.updateEndpointStats(endpointKey, duration);
          this.logRequest(startTime, method, url, response.statusCode, clientIp, userAgent);
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.updateEndpointStats(endpointKey, duration);
          this.logRequest(startTime, method, url, 500, clientIp, userAgent, error);
        },
      }),
    );
  }

  /**
   * 更新端点性能统计
   */
  private updateEndpointStats(endpointKey: string, duration: number): void {
    const existing = PerformanceInterceptor.endpointStats.get(endpointKey);

    if (existing) {
      // 更新现有统计
      existing.totalRequests += 1;
      existing.totalDuration += duration;
      existing.minDuration = Math.min(existing.minDuration, duration);
      existing.maxDuration = Math.max(existing.maxDuration, duration);
      existing.averageDuration = existing.totalDuration / existing.totalRequests;
      existing.lastUpdated = new Date();

      // 更新响应时间分布
      this.updateResponseTimeDistribution(existing.responseTimeDistribution, duration);
    } else {
      // 检查是否超过最大端点数限制
      if (PerformanceInterceptor.endpointStats.size >= PerformanceInterceptor.MAX_ENDPOINTS) {
        // 移除最旧的端点统计
        const oldestEndpoint = this.findOldestEndpoint();
        if (oldestEndpoint) {
          PerformanceInterceptor.endpointStats.delete(oldestEndpoint);
        }
      }

      // 创建新的统计记录
      const newStats: EndpointPerformanceStats = {
        totalRequests: 1,
        totalDuration: duration,
        minDuration: duration,
        maxDuration: duration,
        averageDuration: duration,
        responseTimeDistribution: {
          fast: duration < 100 ? 1 : 0,
          normal: duration >= 100 && duration < 500 ? 1 : 0,
          slow: duration >= 500 && duration < 1000 ? 1 : 0,
          verySlow: duration >= 1000 ? 1 : 0,
        },
        lastUpdated: new Date(),
      };

      PerformanceInterceptor.endpointStats.set(endpointKey, newStats);
    }
  }

  /**
   * 更新响应时间分布统计
   */
  private updateResponseTimeDistribution(distribution: ResponseTimeStats, duration: number): void {
    if (duration < 100) {
      distribution.fast += 1;
    } else if (duration < 500) {
      distribution.normal += 1;
    } else if (duration < 1000) {
      distribution.slow += 1;
    } else {
      distribution.verySlow += 1;
    }
  }

  /**
   * 找到最旧的端点统计记录
   */
  private findOldestEndpoint(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, stats] of PerformanceInterceptor.endpointStats.entries()) {
      if (stats.lastUpdated.getTime() < oldestTime) {
        oldestTime = stats.lastUpdated.getTime();
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private logRequest(
    startTime: number,
    method: string,
    url: string,
    statusCode: number,
    ip: string,
    userAgent: string,
    error?: Error,
  ): void {
    const duration = Date.now() - startTime;
    const logContext = 'PerformanceInterceptor';

    // 构造基础日志信息
    const baseInfo = `${method} ${url} ${statusCode} ${duration}ms [${ip}]`;

    if (error) {
      // 错误请求
      this.logger.error(`${baseInfo} - ERROR: ${error.message}`, error.stack, logContext);
    } else if (duration > PerformanceInterceptor.VERY_SLOW_REQUEST_THRESHOLD) {
      // 非常慢的请求
      this.logger.error(`VERY SLOW REQUEST: ${baseInfo} - UA: ${userAgent}`, logContext);
    } else if (duration > PerformanceInterceptor.SLOW_REQUEST_THRESHOLD) {
      // 慢请求警告
      this.logger.warn(`SLOW REQUEST: ${baseInfo} - UA: ${userAgent}`, logContext);
    } else {
      // 正常请求（仅在开发环境记录详细信息）
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(baseInfo, logContext);
      }
    }
  }

  /**
   * 获取端点性能统计
   */
  static getEndpointStats(): Map<string, EndpointPerformanceStats> {
    return new Map(this.endpointStats);
  }

  /**
   * 获取性能摘要
   */
  static getPerformanceSummary(): {
    totalEndpoints: number;
    slowEndpoints: number;
    averageResponseTime: number;
    totalRequests: number;
    responseTimeDistribution: ResponseTimeStats;
  } {
    let totalRequests = 0;
    let totalDuration = 0;
    let slowEndpoints = 0;
    const globalDistribution: ResponseTimeStats = {
      fast: 0,
      normal: 0,
      slow: 0,
      verySlow: 0,
    };

    for (const stats of this.endpointStats.values()) {
      totalRequests += stats.totalRequests;
      totalDuration += stats.totalDuration;

      if (stats.averageDuration > this.SLOW_REQUEST_THRESHOLD) {
        slowEndpoints += 1;
      }

      // 聚合响应时间分布
      globalDistribution.fast += stats.responseTimeDistribution.fast;
      globalDistribution.normal += stats.responseTimeDistribution.normal;
      globalDistribution.slow += stats.responseTimeDistribution.slow;
      globalDistribution.verySlow += stats.responseTimeDistribution.verySlow;
    }

    return {
      totalEndpoints: this.endpointStats.size,
      slowEndpoints,
      averageResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
      totalRequests,
      responseTimeDistribution: globalDistribution,
    };
  }

  /**
   * 重置统计数据
   */
  static resetStats(): void {
    this.endpointStats.clear();
  }
}
