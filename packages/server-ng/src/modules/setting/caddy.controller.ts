import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { Permission } from '../auth/permissions.decorator';

import { SettingCoreService } from './services/setting-core.service';

@ApiTags('Caddy')
@Controller({ path: 'admin/caddy', version: '2' })
export class CaddyController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  @TsRestHandler(contract.getCaddyLog)
  @Permission('setting', ['read'])
  getCaddyLog_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getCaddyLog, () => {
      const data = this.settingCoreService.getCaddyLog();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.clearCaddyLog)
  @Permission('setting', ['update'])
  clearCaddyLog_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.clearCaddyLog, () => {
      this.settingCoreService.clearCaddyLog();
      return { status: 200, body: 'Caddy logs cleared successfully' };
    });
  }

  @TsRestHandler(contract.getCaddyConfig)
  @Permission('setting', ['read'])
  getCaddyConfig_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getCaddyConfig, async () => {
      const data = await this.settingCoreService.getCaddyConfig();
      return { status: 200, body: data };
    });
  }
}
