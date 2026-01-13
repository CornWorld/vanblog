import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';

import { validateWebhookUrl } from '../../shared/utils/url-validator.util';

import type { Request } from 'express';

/**
 * SSRF 防护守卫
 *
 * 用于保护 webhook 相关的端点，防止 SSRF 攻击。
 * 验证请求体中的 URL 是否指向安全的公共网络地址。
 *
 * @example
 * ```ts
 * @Post('execute')
 * @UseGuards(SSRFProtectionGuard)
 * async executeWebhook(@Body() dto: ExecuteWebhookDto) { ... }
 * ```
 */
@Injectable()
export class SSRFProtectionGuard implements CanActivate {
  private readonly logger = new Logger(SSRFProtectionGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = (request.body as Record<string, unknown> | undefined) ?? {};

    // 从请求体中提取 URL（支持多种可能的字段名）
    const url = (body.url ?? body.webhookUrl ?? body.targetUrl) as string | undefined;

    // 如果没有 URL，放行（可能不是需要验证的请求）
    if (!url || typeof url !== 'string') {
      return true;
    }

    // 验证 URL
    const validationResult = validateWebhookUrl(url);

    if (!validationResult.valid) {
      // 记录安全事件
      this.logger.warn(
        `Blocked SSRF attempt - URL: ${url}, Reason: ${validationResult.reason ?? 'unknown'} - ${validationResult.error ?? 'unknown'}`,
      );

      // 抛出异常，阻止请求
      throw new Error(
        `Webhook URL validation failed: ${validationResult.error ?? 'unknown'}. This URL has been blocked for security reasons.`,
      );
    }

    return true;
  }
}
