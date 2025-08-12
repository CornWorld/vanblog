import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class PerformanceMonitoringMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMonitoringMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl } = req;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const userAgent = req.get('User-Agent') ?? '';

    // Log request start for very verbose debugging (optional)
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`[${method}] ${originalUrl} - Started`);
    }

    // Override res.end to capture response time
    const originalEnd: (chunk?: unknown, encoding?: BufferEncoding, cb?: () => void) => Response =
      res.end.bind(res);
    const { logger } = this;
    res.end = function (chunk?: unknown, encoding?: BufferEncoding, cb?: () => void): Response {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      // Log based on performance thresholds
      if (duration > 3000) {
        // Very slow requests - always log as warning
        logger.warn(
          `VERY SLOW REQUEST: [${method}] ${originalUrl} - ${statusCode} - ${duration}ms - IP: ${ip}`,
        );
      } else if (duration > 1000) {
        // Slow requests - log as warning
        logger.warn(
          `SLOW REQUEST: [${method}] ${originalUrl} - ${statusCode} - ${duration}ms - IP: ${ip}`,
        );
      } else if (process.env.NODE_ENV === 'development') {
        // Normal requests in development
        logger.log(`[${method}] ${originalUrl} - ${statusCode} - ${duration}ms`);
      }

      // Log error responses
      if (statusCode >= 400) {
        logger.error(
          `ERROR RESPONSE: [${method}] ${originalUrl} - ${statusCode} - ${duration}ms - IP: ${ip} - UA: ${userAgent}`,
        );
      }

      // Call original end method
      return originalEnd(chunk, encoding, cb);
    };

    next();
  }

  /**
   * Get performance metrics for monitoring
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
