import { constants as zlibConstants } from 'zlib';

import { Injectable, NestMiddleware } from '@nestjs/common';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * 响应压缩中间件
 *
 * 使用 gzip/deflate 压缩响应内容以减少传输大小，提高网络传输效率。
 * 支持智能内容类型检测，只压缩适合的内容类型，避免对已压缩内容重复压缩。
 */
@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  private readonly compressionHandler = compression({
    // 压缩级别 (1-9, 6是默认值，平衡压缩率和性能)
    level: 6,
    // 最小压缩阈值，小于1KB的响应不压缩
    threshold: 1024,
    // 压缩过滤器
    filter: (req: Request, res: Response) => {
      // 不压缩已经压缩的内容
      if (req.headers['x-no-compression'] !== undefined) {
        return false;
      }

      // 检查 Content-Type
      const contentType = res.getHeader('content-type') as string;
      if (typeof contentType === 'string' && contentType.length > 0) {
        // 压缩文本类型的内容
        return (
          contentType.includes('text/') ||
          contentType.includes('application/json') ||
          contentType.includes('application/javascript') ||
          contentType.includes('application/xml') ||
          contentType.includes('application/rss+xml') ||
          contentType.includes('application/atom+xml') ||
          contentType.includes('image/svg+xml')
        );
      }

      // 默认使用 compression 的内置过滤器
      return compression.filter(req, res);
    },
    // 内存级别 (1-9, 8是默认值)
    memLevel: 8,
    // 压缩策略
    strategy: zlibConstants.Z_DEFAULT_STRATEGY,
  });

  /**
   * 中间件处理函数
   *
   * Express 中间件接口实现，对符合条件的响应内容进行压缩处理。
   *
   * @param req Express 请求对象
   * @param res Express 响应对象
   * @param next 下一个中间件函数
   */
  use(req: Request, res: Response, next: NextFunction): void {
    void this.compressionHandler(req, res, next);
  }
}
