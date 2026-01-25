import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Perm } from '../auth/permissions.decorator';

@ApiTags('Admin Compatibility')
@Controller({ path: 'admin', version: '2' })
export class CompatibilityController {
  // ISR Stubs
  @Post('isr/trigger')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Trigger ISR (Stub)' })
  triggerISR(): { success: boolean; message: string } {
    return { success: true, message: 'ISR trigger stub called' };
  }

  @Get('isr/config')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Get ISR Config (Stub)' })
  getISRConfig(): { skip: boolean; interval: number } {
    return {
      skip: false,
      interval: 3600,
    };
  }

  @Put('isr/config')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Update ISR Config (Stub)' })
  updateISRConfig(@Body() body: Record<string, unknown>): Record<string, unknown> {
    return body;
  }

  // Caddy Stubs
  @Get('caddy/logs')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Get Caddy Logs (Stub)' })
  getCaddyLogs(): { logs: string[] } {
    return { logs: [] };
  }

  @Delete('caddy/logs')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Clear Caddy Logs (Stub)' })
  clearCaddyLogs(): { success: boolean } {
    return { success: true };
  }

  @Get('caddy/config')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Get Caddy Config (Stub)' })
  getCaddyConfig(): { config: string } {
    return { config: '' };
  }

  // Settings Stubs
  @Get('settings/https')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Get HTTPS Config (Stub)' })
  getHttpsConfig(): { enabled: boolean; email: string; domain: string } {
    return {
      enabled: false,
      email: '',
      domain: '',
    };
  }

  @Put('settings/https')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Update HTTPS Config (Stub)' })
  updateHttpsConfig(@Body() body: Record<string, unknown>): Record<string, unknown> {
    return body;
  }

  @Get('settings/login')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Get Login Config (Stub)' })
  getLoginConfig(): { allowRegister: boolean; allowSocialLogin: boolean } {
    return {
      allowRegister: false,
      allowSocialLogin: false,
    };
  }

  @Put('settings/login')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Update Login Config (Stub)' })
  updateLoginConfig(@Body() body: Record<string, unknown>): Record<string, unknown> {
    return body;
  }

  @Get('settings/waline')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Get Waline Config (Stub)' })
  getWalineConfig(): { serverURL: string; pageSize: number } {
    return {
      serverURL: '',
      pageSize: 10,
    };
  }

  @Put('settings/waline')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Update Waline Config (Stub)' })
  updateWalineConfig(@Body() body: Record<string, unknown>): Record<string, unknown> {
    return body;
  }
}
