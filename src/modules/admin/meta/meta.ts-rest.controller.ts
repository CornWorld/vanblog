import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { MetaService } from './meta.service';

@Controller()
export class AdminMetaTsRestController {
  constructor(private readonly metaService: MetaService) {}

  @TsRestHandler(contract.getVersion)
  getVersion() {
    return tsRestHandler(contract.getVersion, async () => {
      const v = this.metaService.getVersionInfo();
      return {
        status: 200,
        body: {
          version: v.version,
          latestVersion: v.latestVersion,
          needUpdate: v.hasUpdate,
        },
      };
    });
  }
}