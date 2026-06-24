import { createHash } from 'crypto';

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import type { Request, Response } from 'express';

/**
 * Linus 式 ETag 缓存拦截器 - 简单、直接、零特殊情况
 *
 * 核心原则：
 * 1. 任何响应数据都可以生成 ETag
 * 2. 304 Not Modified 减少网络传输
 * 3. 零配置，自动处理所有 GET 请求
 */
@Injectable()
export class ETagCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // 只处理 GET 请求
    if (request.method !== 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        // 生成内容的 ETag
        const etag = this.generateETag(data);
        response.setHeader('ETag', etag);
        response.setHeader('Cache-Control', 'no-cache');

        // 检查客户端的 If-None-Match 头
        const clientETag = request.headers['if-none-match'];
        if (clientETag === etag) {
          response.status(304);
          return null; // 304 响应不应该有 body
        }

        return data;
      }),
    );
  }

  /**
   * 生成 ETag - 使用 MD5 哈希内容
   */
  private generateETag(data: unknown): string {
    const content = JSON.stringify(data);
    const hash = createHash('md5').update(content).digest('hex');
    return `"${hash}"`;
  }
}
