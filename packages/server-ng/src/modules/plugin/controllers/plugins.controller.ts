import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

import { Perm } from '../../auth/permissions.decorator';
import { LoaderService, type Plugin } from '../services/loader.service';
import { PluginConfigService } from '../services/plugin-config.service';

export interface PluginInfo {
  name: string;
  version: string;
  description?: string;
  loaded: boolean;
}

export interface PluginListResponse {
  plugins: PluginInfo[];
  total: number;
}

export interface PluginReloadResponse {
  success: boolean;
  message: string;
  loadedCount: number;
}

export interface PluginUnloadResponse {
  success: boolean;
  message: string;
}

@ApiTags('Plugins - Blog')
@Controller({ path: 'admin/plugins', version: '2' })
export class PluginsController {
  private readonly logger = new Logger(PluginsController.name);

  constructor(
    private readonly loaderService: LoaderService,
    private readonly configService: PluginConfigService,
  ) {
    // Downgrade noisy test-time log to warn to avoid false positives in log scans
    this.logger.warn('PluginsController initialized (WARN LEVEL)');
  }

  @Get()
  @Perm('plugin', ['read'])
  @ApiOperation({ summary: 'Get all loaded plugins' })
  @ApiResponse({
    status: 200,
    description: 'List of loaded plugins',
    schema: {
      type: 'object',
      properties: {
        plugins: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              description: { type: 'string' },
              loaded: { type: 'boolean' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  })
  getPlugins(): PluginListResponse {
    const loadedPlugins: Map<string, Plugin> = this.loaderService.getLoadedPlugins();
    const plugins: PluginInfo[] = [];

    for (const plugin of loadedPlugins.values()) {
      plugins.push({
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        loaded: true,
      });
    }

    return {
      plugins,
      total: plugins.length,
    };
  }

  @Get(':name')
  @Perm('plugin', ['read'])
  @ApiOperation({ summary: 'Get plugin details by name' })
  @ApiParam({ name: 'name', description: 'Plugin name' })
  @ApiResponse({
    status: 200,
    description: 'Plugin details',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
        description: { type: 'string' },
        loaded: { type: 'boolean' },
        hooks: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['action', 'filter'] },
              priority: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  getPlugin(@Param('name') name: string): Plugin | null {
    const loadedPlugins = this.loaderService.getLoadedPlugins();
    return loadedPlugins.get(name) ?? null;
  }

  @Post('reload')
  @Perm('plugin', ['configure'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reload all plugins' })
  @ApiResponse({
    status: 200,
    description: 'Plugins reloaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        loadedCount: { type: 'number' },
      },
    },
  })
  async reloadPlugins(): Promise<PluginReloadResponse> {
    try {
      await this.loaderService.reloadPlugins();
      const loadedCount = this.loaderService.getLoadedPlugins().size;

      return {
        success: true,
        message: 'Plugins reloaded successfully',
        loadedCount,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reload plugins',
        loadedCount: 0,
      };
    }
  }

  @Delete(':name')
  @Perm('plugin', ['disable'])
  @ApiOperation({ summary: 'Unload a specific plugin' })
  @ApiParam({ name: 'name', description: 'Plugin name to unload' })
  @ApiResponse({
    status: 200,
    description: 'Plugin unloaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  async unloadPlugin(@Param('name') pluginName: string): Promise<PluginUnloadResponse> {
    const success = await this.loaderService.unloadPlugin(pluginName);

    if (success) {
      return {
        success: true,
        message: `Plugin '${pluginName}' unloaded successfully`,
      };
    } else {
      return {
        success: false,
        message: `Plugin '${pluginName}' not found or failed to unload`,
      };
    }
  }

  @Get('failed')
  @Perm('plugin', ['read'])
  @ApiOperation({ summary: 'Get failed plugins' })
  @ApiResponse({
    status: 200,
    description: 'List of failed plugin names',
    schema: {
      type: 'array',
      items: { type: 'string' },
    },
  })
  getFailedPlugins(): string[] {
    return Array.from(this.loaderService.getFailedPlugins());
  }

  // ========== 配置管理 API ==========

  @Get(':name/config/schema')
  @Perm('plugin', ['read'])
  @ApiOperation({ summary: 'Get plugin configuration schema' })
  @ApiParam({ name: 'name', description: 'Plugin name' })
  @ApiResponse({
    status: 200,
    description: 'Plugin configuration schema',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['string', 'number', 'boolean', 'array', 'object'] },
          title: { type: 'string' },
          description: { type: 'string' },
          default: {},
          enum: { type: 'array' },
          min: { type: 'number' },
          max: { type: 'number' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found or no config schema' })
  getPluginConfigSchema(@Param('name') pluginName: string): Record<string, unknown> {
    const schema = this.configService.getSchema(pluginName);
    if (!schema) {
      throw new NotFoundException(`Plugin '${pluginName}' not found or has no config schema`);
    }
    return schema;
  }

  @Get(':name/config')
  @Perm('plugin', ['read'])
  @ApiOperation({ summary: 'Get plugin configuration' })
  @ApiParam({ name: 'name', description: 'Plugin name' })
  @ApiResponse({
    status: 200,
    description: 'Plugin configuration values',
    schema: {
      type: 'object',
      additionalProperties: true,
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  async getPluginConfig(@Param('name') pluginName: string): Promise<Record<string, unknown>> {
    const schema = this.configService.getSchema(pluginName);
    if (!schema) {
      throw new NotFoundException(`Plugin '${pluginName}' not found`);
    }
    return this.configService.getConfig(pluginName);
  }

  @Put(':name/config')
  @Perm('plugin', ['configure'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update plugin configuration (bulk)' })
  @ApiParam({ name: 'name', description: 'Plugin name' })
  @ApiBody({
    description: 'Configuration values to update',
    schema: {
      type: 'object',
      additionalProperties: true,
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        updated: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiResponse({ status: 400, description: 'Invalid configuration value' })
  async updatePluginConfig(
    @Param('name') pluginName: string,
    @Body() config: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string; updated: number }> {
    const schema = this.configService.getSchema(pluginName);
    if (!schema) {
      throw new NotFoundException(`Plugin '${pluginName}' not found`);
    }

    const results = await this.configService.setConfigs(pluginName, config);
    const updated = Object.values(results).filter((r) => r).length;
    const failed = Object.values(results).filter((r) => !r).length;

    if (failed > 0) {
      throw new BadRequestException(
        `Failed to update ${failed} configuration value(s). ${updated} value(s) updated successfully.`,
      );
    }

    return {
      success: true,
      message: `Successfully updated ${updated} configuration value(s)`,
      updated,
    };
  }

  @Patch(':name/config/:key')
  @Perm('plugin', ['configure'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update single plugin configuration value' })
  @ApiParam({ name: 'name', description: 'Plugin name' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  @ApiBody({
    description: 'Configuration value',
    schema: {
      type: 'object',
      properties: {
        value: {},
      },
      required: ['value'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  @ApiResponse({ status: 400, description: 'Invalid configuration value' })
  async updatePluginConfigValue(
    @Param('name') pluginName: string,
    @Param('key') key: string,
    @Body('value') value: unknown,
  ): Promise<{ success: boolean; message: string }> {
    const schema = this.configService.getSchema(pluginName);
    if (!schema) {
      throw new NotFoundException(`Plugin '${pluginName}' not found`);
    }

    const success = await this.configService.setConfig(pluginName, key, value);

    if (!success) {
      throw new BadRequestException(`Invalid value for configuration key '${key}'`);
    }

    return {
      success: true,
      message: `Configuration '${key}' updated successfully`,
    };
  }
}
