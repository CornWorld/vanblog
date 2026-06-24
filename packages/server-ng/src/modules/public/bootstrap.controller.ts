import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';

import { BootstrapService } from './bootstrap.service';

import type { PublicBootstrapResponseDto } from './bootstrap.dto';

type VersionInfo = {
  version: string;
  latestVersion: string;
  hasUpdate: boolean;
  updateInfo?: {
    version: string;
    description: string;
    url: string;
  };
};

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

  @Get('version')
  @ApiOperation({ summary: '获取版本信息' })
  @ApiResponse({
    status: 200,
    description: '版本信息获取成功',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        data: {
          type: 'object',
          properties: {
            version: { type: 'string', example: 'dev' },
            latestVersion: { type: 'string', example: 'v1.0.0' },
            hasUpdate: { type: 'boolean', example: false },
            updateInfo: {
              type: 'object',
              properties: {
                version: { type: 'string' },
                description: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  getVersionInfo(): { statusCode: number; data: VersionInfo } {
    const data = this.bootstrapService.getVersionInfo();
    return { statusCode: 200, data };
  }
}
