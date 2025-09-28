import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Perm } from '../auth/permissions.decorator';

import { CaddyService } from './caddy.service';

import type { HttpsSettings } from './caddy.schema';

@ApiTags('Caddy')
@Controller({ path: 'api/admin/caddy', version: '2' })
export class CaddyController {
  constructor(private readonly caddyService: CaddyService) {}

  @Get('https-settings')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get HTTPS settings' })
  @ApiResponse({
    status: 200,
    description: 'HTTPS settings retrieved successfully',
  })
  async getHttpsSettings(): Promise<HttpsSettings | null> {
    return this.caddyService.getHttpsSettings();
  }

  @Patch('https-settings')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update HTTPS settings' })
  @ApiResponse({
    status: 200,
    description: 'HTTPS settings updated successfully',
  })
  async updateHttpsSettings(@Body() settings: HttpsSettings): Promise<HttpsSettings> {
    return this.caddyService.updateHttpsSettings(settings);
  }

  @Post('redirect')
  @Perm('setting', ['update'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable HTTPS redirect' })
  @ApiResponse({
    status: 200,
    description: 'HTTPS redirect enabled successfully',
  })
  async enableRedirect(): Promise<{ success: boolean; message: string | false }> {
    const result = await this.caddyService.setRedirect(true);
    return {
      success: result !== false,
      message: result,
    };
  }

  @Delete('redirect')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Disable HTTPS redirect' })
  @ApiResponse({
    status: 200,
    description: 'HTTPS redirect disabled successfully',
  })
  async disableRedirect(): Promise<{ success: boolean; message: string | false }> {
    const result = await this.caddyService.setRedirect(false);
    return {
      success: result !== false,
      message: result,
    };
  }

  @Get('subjects')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get managed domain subjects' })
  @ApiResponse({
    status: 200,
    description: 'Domain subjects retrieved successfully',
  })
  async getSubjects(): Promise<string[] | null> {
    return this.caddyService.getSubjects();
  }

  @Patch('subjects')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update domain subjects' })
  @ApiResponse({
    status: 200,
    description: 'Domain subjects updated successfully',
  })
  async updateSubjects(@Body('domains') domains: string[]): Promise<{ success: boolean }> {
    const success = await this.caddyService.updateSubjects(domains);
    return { success };
  }

  @Post('subjects/:domain')
  @Perm('setting', ['update'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add domain subject' })
  @ApiResponse({
    status: 200,
    description: 'Domain subject added successfully',
  })
  async addSubject(@Body('domain') domain: string): Promise<{ success: boolean }> {
    await this.caddyService.addSubject(domain);
    return { success: true };
  }

  @Get('automatic-domains')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get automatic domains' })
  @ApiResponse({
    status: 200,
    description: 'Automatic domains retrieved successfully',
  })
  async getAutomaticDomains(): Promise<string[] | null> {
    return this.caddyService.getAutomaticDomains();
  }

  @Patch('https-domains')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Update HTTPS domains' })
  @ApiResponse({
    status: 200,
    description: 'HTTPS domains updated successfully',
  })
  async updateHttpsDomains(@Body('domains') domains: string[]): Promise<{ success: boolean }> {
    const success = await this.caddyService.updateHttpsDomains(domains);
    return { success };
  }

  @Post('apply-https-change')
  @Perm('setting', ['update'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply HTTPS domain changes' })
  @ApiResponse({
    status: 200,
    description: 'HTTPS changes applied successfully',
  })
  async applyHttpsChange(@Body('domains') domains: string[]): Promise<{ success: boolean }> {
    const success = await this.caddyService.applyHttpsChange(domains);
    return { success };
  }

  @Get('config')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get Caddy configuration' })
  @ApiResponse({
    status: 200,
    description: 'Caddy configuration retrieved successfully',
  })
  async getConfig(): Promise<Record<string, unknown> | null> {
    return this.caddyService.getConfig();
  }

  @Get('logs')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get Caddy logs' })
  @ApiResponse({
    status: 200,
    description: 'Caddy logs retrieved successfully',
  })
  async getLogs(): Promise<{ logs: string }> {
    const logs = await this.caddyService.getLog();
    return { logs };
  }

  @Delete('logs')
  @Perm('caddy:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear Caddy logs' })
  @ApiResponse({
    status: 204,
    description: 'Caddy logs cleared successfully',
  })
  clearLogs(): void {
    this.caddyService.clearLog();
  }
}
