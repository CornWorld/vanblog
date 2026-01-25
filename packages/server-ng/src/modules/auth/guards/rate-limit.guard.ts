import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { LoginLogService } from '../login-log.service';

import type { Request } from 'express';

/**
 * 速率限制守卫
 * 防止暴力破解攻击，限制登录尝试频率
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly loginLogService: LoginLogService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { username } = request.body as { username?: string };
    const clientIp = this.getClientIp(request);

    // 如果没有用户名，跳过速率限制检查（让后续验证处理）
    if (!username) {
      return true;
    }

    // 检查基于用户名的失败尝试次数
    const userFailedAttempts = await this.loginLogService.getRecentFailedAttempts(
      username,
      30, // 30分钟内
    );

    // 检查基于IP的失败尝试次数
    const ipFailedAttempts = await this.loginLogService.getRecentFailedAttemptsByIp(clientIp, 30);

    // 用户名限制：30分钟内最多5次失败尝试
    if (userFailedAttempts >= 5) {
      throw new HttpException(
        {
          message: '登录尝试次数过多，请30分钟后再试',
          error: 'Too Many Attempts',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          retryAfter: this.getRetryAfter(30),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // IP限制：30分钟内最多10次失败尝试
    if (ipFailedAttempts >= 10) {
      throw new HttpException(
        {
          message: 'IP地址登录尝试次数过多，请30分钟后再试',
          error: 'Too Many Attempts',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          retryAfter: this.getRetryAfter(30),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * 获取客户端真实IP地址
   */
  private getClientIp(request: Request): string {
    const xForwardedFor = request.headers['x-forwarded-for'] as string | undefined;
    const xRealIp = request.headers['x-real-ip'] as string | undefined;

    return (
      (xForwardedFor && xForwardedFor.length > 0 ? xForwardedFor.split(',')[0]?.trim() : null) ??
      (xRealIp && xRealIp.length > 0 ? xRealIp : null) ??
      request.socket.remoteAddress ??
      request.ip ??
      'unknown'
    );
  }

  /**
   * 计算重试时间（秒）
   */
  private getRetryAfter(minutes: number): number {
    return minutes * 60;
  }
}
