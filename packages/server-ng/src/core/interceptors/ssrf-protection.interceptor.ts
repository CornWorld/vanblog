import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';

import { validateWebhookUrl } from '../../shared/utils/url-validator.util';

import type { Request } from 'express';

/**
 * SSRF 防护拦截器
 *
 * 拦截 webhook 执行请求，验证目标 URL 是否安全。
 * 防止服务器端请求伪造（SSRF）攻击。
 *
 * @example
 * ```ts
 * @UseInterceptors(SSRFProtectionInterceptor)
 * async executeWebhook(@Body('url') url: string) { ... }
 * ```
 */
@Injectable()
export class SSRFProtectionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SSRFProtectionInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const body = (request.body as Record<string, unknown> | undefined) ?? {};
    const url = body.url as string | undefined;
    const webhookId =
      typeof body.webhookId === 'string' || typeof body.webhookId === 'number'
        ? String(body.webhookId)
        : 'unknown';
    const event = body.event as string | undefined;

    // 如果有 URL，则进行 SSRF 验证
    if (url && typeof url === 'string') {
      const validationResult = validateWebhookUrl(url);

      if (!validationResult.valid) {
        // 记录安全事件
        this.logger.warn(
          `Blocked SSRF attempt - Webhook ID: ${webhookId}, URL: ${url}, Event: ${event ?? 'unknown'}, Reason: ${validationResult.reason ?? 'unknown'} - ${validationResult.error ?? 'unknown'}`,
        );

        // 返回错误响应
        return throwError(
          () =>
            new Error(
              `Webhook URL validation failed: ${validationResult.error ?? 'unknown'}. This URL has been blocked for security reasons.`,
            ),
        );
      }
    }

    return next.handle();
  }
}
