import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
// import { z } from 'zod';

import { Perm } from '../../auth/permissions.decorator';
import {
  InstallPicGoPluginSchema,
  PicGoPluginListResponseSchema,
  PicGoPluginOperationResponseSchema,
  UninstallPicGoPluginSchema,
  PicGoPluginLogsResponseSchema,
  type PicGoPluginListResponseDto,
  type PicGoPluginLogsResponseDto,
  type PicGoPluginOperationResponseDto,
} from '../dto/picgo-plugin.dto';
import { PicgoStorageService } from '../services/storages/picgo-storage.service';

@ApiTags('Media - PicGo Plugins')
@Controller({ path: 'admin/media/picgo/plugins', version: '2' })
export class PicgoPluginsController {
  private readonly logger = new Logger(PicgoPluginsController.name);

  constructor(private readonly picgoStorage: PicgoStorageService) {}

  @Get()
  @Perm('setting', ['read'])
  @ApiOperation({ summary: '查询 PicGo 插件列表（PicGo API 不提供列表，返回空结构）' })
  @ApiResponse({ status: 200, description: 'Plugin list' })
  listPlugins(): PicGoPluginListResponseDto {
    // 目前 picgo 插件系统未暴露 list 接口，保持返回空列表，向后兼容
    return PicGoPluginListResponseSchema.parse({ plugins: [], total: 0 });
  }

  @Get('logs')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: '查询 PicGo 插件执行日志（内存缓冲，最近若干条）' })
  @ApiResponse({ status: 200, description: 'Plugin logs' })
  getLogs(): PicGoPluginLogsResponseDto {
    const { logs, total } = this.picgoStorage.getPluginLogs();
    return PicGoPluginLogsResponseSchema.parse({ logs, total });
  }

  @Post('install')
  @Perm('setting', ['update'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '安装 PicGo 插件' })
  @ApiResponse({ status: 200, description: 'Install result' })
  async install(@Body() raw: unknown): Promise<PicGoPluginOperationResponseDto> {
    const body = InstallPicGoPluginSchema.parse(raw);
    try {
      await this.picgoStorage.installPlugins(body.plugins);
      return PicGoPluginOperationResponseSchema.parse({
        success: true,
        message: 'Plugins installed successfully',
        installedPlugins: body.plugins,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`Install PicGo plugins failed: ${message}`);
      return PicGoPluginOperationResponseSchema.parse({
        success: false,
        message,
        errors: [message],
      });
    }
  }

  @Post('uninstall')
  @Perm('setting', ['update'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '卸载 PicGo 插件（PicGo 未提供卸载能力，此接口返回失败说明）' })
  @ApiResponse({ status: 200, description: 'Uninstall result' })
  uninstall(@Body() raw: unknown): PicGoPluginOperationResponseDto {
    const body = UninstallPicGoPluginSchema.parse(raw);
    const message = 'PicGo does not support uninstalling plugins via API';
    this.logger.warn(`${message}: ${body.plugins.join(', ')}`);
    return PicGoPluginOperationResponseSchema.parse({
      success: false,
      message,
      errors: [message],
    });
  }
}
