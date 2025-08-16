import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PublicBootstrapResponseDto } from './bootstrap.dto';
import { BootstrapService } from './bootstrap.service';

@ApiTags('公共接口')
@Controller({ path: 'public', version: '2' })
export class BootstrapController {
  constructor(private readonly bootstrapService: BootstrapService) {}

  @Get('bootstrap')
  @ApiOperation({ summary: '获取站点元数据' })
  async getBootstrap(): Promise<{ statusCode: number; data: PublicBootstrapResponseDto }> {
    const data = await this.bootstrapService.getPublicBootstrap();
    return { statusCode: 200, data };
  }
}
