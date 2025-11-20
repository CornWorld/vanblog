import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
import { SettingCoreService } from './services/setting-core.service';

@Controller()
export class SettingCoreTsRestController {
  constructor(private readonly settingCoreService: SettingCoreService) {}

  @TsRestHandler(contract.getSiteInfo)
  async getSiteInfo() {
    return tsRestHandler(contract.getSiteInfo, async () => {
      const data = await this.settingCoreService.getSiteInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(contract.updateSiteInfo)
  async updateSiteInfo() {
    return tsRestHandler(contract.updateSiteInfo, async ({ body }) => {
      const data = await this.settingCoreService.updateSiteInfo(body);
      return { status: 200, body: data };
    });
  }
}
