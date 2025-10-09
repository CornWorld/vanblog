import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { LoggerService } from '../logger/logger.service';

import type { Request, Response } from 'express';

/**
 * Linus 式性能监控拦截器 - 简单、直接、零特殊情况
 *
 * 核心原则：
 * 1. 记录每个请求的响应时间
 * 2. 识别慢请求并记录警告
 * 3. 零配置，自动处理所有请求
 * 4. 不破坏任何现有功能
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private static readonly SLOW_REQUEST_THRESHOLD = 1000; // 1秒

  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const startTime = Date.now();
    const { method, url, ip, socket, headers } = request;
    const userAgent = headers['user-agent'] ?? 'unknown';
    const clientIp = ip ?? socket.remoteAddress ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequest(startTime, method, url, response.statusCode, clientIp, userAgent);
        },
        error: (error: Error) => {
          this.logRequest(startTime, method, url, 500, clientIp, userAgent, error);
        },
      }),
    );
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
}
