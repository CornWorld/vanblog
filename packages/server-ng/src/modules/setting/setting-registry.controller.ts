import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SettingRegistryService } from './services/setting-registry.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

@ApiTags('config')
@Controller('api/admin/config')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SettingRegistryController {
  constructor(private readonly settingRegistryService: SettingRegistryService) {}

  @Get('keys')
  @Permissions('setting:read')
  @ApiOperation({ summary: 'Get all registered configuration keys' })
  getRegisteredKeys(): string[] {
    return this.settingRegistryService.getRegisteredKeys();
  }

  @Get(':key')
  @Permissions('setting:read')
  @ApiOperation({ summary: 'Get configuration value by key' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  async getConfig(@Param('key') key: string): Promise<{ key: string; value: unknown }> {
    const value = await this.settingRegistryService.getConfig(key);
    if (value === null) {
      const registration = this.settingRegistryService.getRegistration(key);
      if (!registration) {
        throw new HttpException(
          `Configuration key "${key}" is not registered`,
          HttpStatus.NOT_FOUND,
        );
      }
    }
    return { key, value };
  }

  @Put(':key')
  @Permissions('setting:update')
  @ApiOperation({ summary: 'Update configuration value' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  async updateConfig(
    @Param('key') key: string,
    @Body('value') value: unknown,
  ): Promise<{ key: string; value: unknown }> {
    const registration = this.settingRegistryService.getRegistration(key);
    if (!registration) {
      throw new HttpException(
        `Configuration key "${key}" is not registered`,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const updated = await this.settingRegistryService.updateConfig(key, value);
      return { key, value: updated };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update configuration';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':key')
  @Permissions('setting:update')
  @ApiOperation({ summary: 'Delete configuration value' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  async deleteConfig(@Param('key') key: string): Promise<{ message: string }> {
    await this.settingRegistryService.deleteConfig(key);
    return { message: `Configuration key "${key}" deleted successfully` };
  }
}
