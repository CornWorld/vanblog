import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { InitCmsRequestSchema, type InitCmsResponseDto } from './dto/init.dto';
import { InitService } from './init.service';

@ApiTags('Public')
@Controller({ path: 'public', version: '2' })
export class InitController {
  constructor(private readonly initService: InitService) {}

  @Post('init')
  @HttpCode(200)
  @ApiOperation({ summary: '初始化 CMS（仅在首次运行时可用）' })
  @ApiResponse({ status: 200, description: '初始化成功' })
  async init(@Body() raw: unknown): Promise<{ statusCode: number; data: InitCmsResponseDto }> {
    const body = InitCmsRequestSchema.parse(raw);
    const data = await this.initService.initializeCms(body);
    return { statusCode: 200, data };
  }
}
