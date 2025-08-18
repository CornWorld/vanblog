import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';

import { PublicBootstrapResponseDto } from './bootstrap.dto';
import { BootstrapService } from './bootstrap.service';

@ApiTags('Public')
@Controller({ path: 'public', version: '2' })
export class BootstrapController {
  constructor(private readonly bootstrapService: BootstrapService) {}

  @Get('bootstrap')
  @ApiOperation({ summary: '获取站点元数据' })
  @ApiResponse({
    status: 200,
    description: '站点元数据获取成功',
    type: Object,
  })
  async getBootstrap(): Promise<{ statusCode: number; data: PublicBootstrapResponseDto }> {
    const data = await this.bootstrapService.getPublicBootstrap();
    return { statusCode: 200, data };
  }
}
