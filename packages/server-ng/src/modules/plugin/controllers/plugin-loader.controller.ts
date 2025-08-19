import { Controller, Get, Post, Delete, Param, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

import { PluginLoaderService, type Plugin } from '../services/plugin-loader.service';

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

@ApiTags('Plugin Management')
@Controller('v2/plugins')
export class PluginLoaderController {
  private readonly logger = new Logger(PluginLoaderController.name);

  constructor(private readonly pluginLoaderService: PluginLoaderService) {
    // Downgrade noisy test-time log to warn to avoid false positives in log scans
    this.logger.warn('PluginLoaderController initialized (WARN LEVEL)');
  }

  @Get()
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
    const loadedPlugins = this.pluginLoaderService.getLoadedPlugins();
    const plugins: PluginInfo[] = [];

    for (const [, plugin] of loadedPlugins) {
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
    const loadedPlugins = this.pluginLoaderService.getLoadedPlugins();
    return loadedPlugins.get(name) ?? null;
  }

  @Post('reload')
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
      await this.pluginLoaderService.reloadPlugins();
      const loadedCount = this.pluginLoaderService.getLoadedPlugins().size;

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
    const success = await this.pluginLoaderService.unloadPlugin(pluginName);

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
}
