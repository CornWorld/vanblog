import { Body, Controller, Post, HttpCode, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { InitCmsRequestSchema, type InitCmsResponseDto } from './dto/init.dto';
import { InitService } from './init.service';

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
    const body = InitCmsRequestSchema.parse(raw);
    const data = await this.initService.initializeCms(body);
    return { statusCode: 200, data };
  }
}
