import { Controller, Get, Post, Delete, Param, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

import { Perm } from '../../auth/permissions.decorator';
import { LoaderService, type Plugin } from '../services/loader.service';

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

  constructor(private readonly loaderService: LoaderService) {
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
}
