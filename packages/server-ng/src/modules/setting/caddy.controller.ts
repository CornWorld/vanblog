import { Controller, Delete, Get, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Permission } from '../auth/permissions.decorator';

import { SettingCoreService } from './services/setting-core.service';

@ApiTags('Caddy')
@Controller({ path: 'caddy', version: '2' })
export class CaddyController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  @Permission('setting', ['read'])
  @Get('logs')
  getCaddyLog(): string {
    return this.settingCoreService.getCaddyLog();
  }

  @Permission('setting', ['update'])
  @Delete('logs')
  @HttpCode(200)
  clearCaddyLog(): string {
    this.settingCoreService.clearCaddyLog();
    return 'Caddy logs cleared successfully';
  }

  @Permission('setting', ['read'])
  @Get('config')
  async getCaddyConfig(): Promise<unknown> {
    return await this.settingCoreService.getCaddyConfig();
  }
}
