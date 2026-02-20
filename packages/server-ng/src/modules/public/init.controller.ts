import { Body, Controller, Post, HttpCode, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  InitCmsRequestSchema,
  type InitCmsRequestDto,
  type InitCmsResponseDto,
} from './dto/init.dto';
import { InitService } from './init.service';

/**
 * Normalize the init request body to accept both:
 * 1. Nested format: { admin: { username, password }, siteInfo: {...} }
 * 2. Flat format (from contract): { username, password, email }
 */
function normalizeInitBody(raw: unknown): InitCmsRequestDto {
  // Try nested format first
  const nested = InitCmsRequestSchema.safeParse(raw);
  if (nested.success) {
    return nested.data;
  }

  // Try flat format (contract: { username, password, email })
  if (typeof raw === 'object' && raw !== null && 'username' in raw) {
    const flat = raw as Record<string, unknown>;
    const transformed = {
      admin: {
        username: flat.username as string,
        password: flat.password as string,
        ...(flat.email ? { email: flat.email as string } : {}),
        ...(flat.nickname ? { nickname: flat.nickname as string } : {}),
      },
      siteInfo: flat.siteInfo as Record<string, unknown> | undefined,
    };
    return InitCmsRequestSchema.parse(transformed);
  }

  // Neither format matched, let Zod provide the error
  return InitCmsRequestSchema.parse(raw);
}

@ApiTags('Public')
@Controller({ path: 'public', version: VERSION_NEUTRAL })
export class InitController {
  constructor(private readonly initService: InitService) {}

  @Post('init')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 限制每分钟最多5次请求，防止滥用
  @HttpCode(200)
  @ApiOperation({ summary: '初始化 CMS（仅在首次运行时可用）' })
  @ApiResponse({ status: 200, description: '初始化成功' })
  async init(@Body() raw: unknown): Promise<{ statusCode: number; data: InitCmsResponseDto }> {
    const body = normalizeInitBody(raw);
    const data = await this.initService.initializeCms(body);
    return { statusCode: 200, data };
  }
}
