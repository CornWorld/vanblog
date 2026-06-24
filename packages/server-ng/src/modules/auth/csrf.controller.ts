import { randomBytes } from 'crypto';

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

/**
 * CSRF Controller
 *
 * Provides CSRF token generation endpoint for CSRF protection.
 */
@ApiTags('auth')
@Controller('auth')
export class CsrfController {
  @Get('csrf-token')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 限制每分钟最多60次请求，防止滥用
  @ApiOperation({ summary: 'Get CSRF token' })
  @ApiResponse({
    status: 200,
    description: 'CSRF token for form submissions',
    schema: {
      type: 'object',
      properties: {
        csrfToken: {
          type: 'string',
          description: 'CSRF token for validation',
        },
      },
    },
  })
  getCsrfToken(): { csrfToken: string } {
    // 使用 crypto 安全的随机数生成 token
    const token = randomBytes(32).toString('hex');
    return {
      csrfToken: token,
    };
  }
}
