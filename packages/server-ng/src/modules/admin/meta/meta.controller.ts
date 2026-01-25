import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Perm } from '../../auth/permissions.decorator';

import { MetaService } from './meta.service';

/**
 * 管理端元数据控制器
 *
 * 提供管理端需要的元数据信息，如版本信息、系统状态等
 */
@ApiTags('Admin Meta')
@Controller({ path: 'admin/meta', version: '2' })
export class AdminMetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('version')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Get version information' })
  @ApiResponse({
    status: 200,
    description: 'Version information retrieved successfully',
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
  getVersionInfo(): {
    statusCode: number;
    data: {
      version: string;
      latestVersion: string;
      hasUpdate: boolean;
      updateInfo?: {
        version: string;
        description: string;
        url: string;
      };
    };
  } {
    const data = this.metaService.getVersionInfo();
    return { statusCode: 200, data };
  }
}
