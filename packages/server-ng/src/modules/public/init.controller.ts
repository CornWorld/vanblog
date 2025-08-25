import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { InitCmsRequestDto, InitCmsResponseDto, InitCmsRequestSchema } from './dto/init.dto';
import { InitService } from './init.service';

@ApiTags('Public')
@Controller({ path: 'public', version: '2' })
export class InitController {
  constructor(private readonly initService: InitService) {}

  @Post('init')
  @HttpCode(200)
  @ApiOperation({ summary: '初始化 CMS（仅在首次运行时可用）' })
  @ApiResponse({ status: 200, description: '初始化成功', type: InitCmsResponseDto })
  async init(
    @Body(new ZodValidationPipe(InitCmsRequestSchema)) body: InitCmsRequestDto,
  ): Promise<{ statusCode: number; data: InitCmsResponseDto }> {
    const data = await this.initService.initializeCms(body);
    return { statusCode: 200, data };
  }
}
