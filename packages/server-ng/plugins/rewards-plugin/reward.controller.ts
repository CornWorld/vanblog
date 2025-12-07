import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { Perm } from '../../src/modules/auth/permissions.decorator';

import { rewardContract } from './reward.contract';
import { RewardInfoSchema } from './reward.dto';
import { RewardService } from './reward.service';

@ApiTags('reward')
@Controller('api/admin/reward')
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  @TsRestHandler(rewardContract.list)
  @Perm('setting', ['read'])
  getRewardInfo(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(rewardContract.list, async () => {
      const data = await this.rewardService.getRewardInfo();
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(rewardContract.upsert)
  @Perm('setting', ['update'])
  addOrUpdateRewardInfo(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(rewardContract.upsert, async ({ body }) => {
      const dto = RewardInfoSchema.parse(body);
      const data = await this.rewardService.addOrUpdateRewardInfo(dto);
      return { status: 200, body: data };
    });
  }

  @TsRestHandler(rewardContract.delete)
  @Perm('setting', ['update'])
  deleteRewardInfo(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(rewardContract.delete, async ({ params }) => {
      const data = await this.rewardService.deleteRewardInfo(params.name);
      return { status: 200, body: data };
    });
  }
}
