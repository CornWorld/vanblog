import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { DerivedView } from '../../shared/decorators/derived-view.decorator';

import { OptionsQueryDto, OptionsResponseDto, OptionsQuerySchema } from './dto/options.dto';
import { OptionsService } from './options.service';

@ApiTags('Public')
@Controller({ path: 'public', version: '2' })
export class OptionsController {
  constructor(private readonly optionsService: OptionsService) {}

  @Get('options')
  @Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 10, ttl: 10000 } })
  @ApiOperation({ summary: '获取站点配置选项' })
  @ApiResponse({
    status: 200,
    description: '站点配置选项获取成功',
    type: OptionsResponseDto,
  })
  @DerivedView({ key: 'options', ttl: 300, swr: true })
  async getOptions(
    @Query(new ZodValidationPipe(OptionsQuerySchema)) query: OptionsQueryDto,
  ): Promise<{ statusCode: number; data: OptionsResponseDto }> {
    const data = await this.optionsService.getOptions(query);
    return { statusCode: 200, data };
  }
}
