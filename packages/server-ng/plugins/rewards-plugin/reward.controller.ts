import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { Perm } from '../../src/modules/auth/permissions.decorator';

import { RewardInfoDto, RewardInfoSchema } from './reward.dto';
import { RewardService } from './reward.service';

import type { RewardInfo } from './reward.schema';

@ApiTags('reward')
@Controller('api/admin/reward')
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  @Get()
  @Perm('setting', ['read'])
  @ApiOperation({ summary: 'Get all reward information' })
  async getRewardInfo(): Promise<RewardInfo[]> {
    return this.rewardService.getRewardInfo();
  }

  @Post()
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Add or update reward information' })
  async addOrUpdateRewardInfo(
    @Body(new ZodValidationPipe(RewardInfoSchema)) dto: RewardInfoDto,
  ): Promise<RewardInfo[]> {
    return this.rewardService.addOrUpdateRewardInfo(dto);
  }

  @Delete(':name')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: 'Delete reward information' })
  @ApiParam({ name: 'name', description: 'Reward method name' })
  async deleteRewardInfo(@Param('name') name: string): Promise<RewardInfo[]> {
    return this.rewardService.deleteRewardInfo(name);
  }
}
