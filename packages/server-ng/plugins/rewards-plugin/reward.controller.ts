import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { Permission } from '../../src/modules/auth/permissions.decorator';

import { RewardInfoDto, RewardInfoSchema } from './reward.dto';
import { RewardService } from './reward.service';

import type { RewardInfo } from './reward.schema';

@ApiTags('reward')
@Controller('api/admin/reward')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  @Get()
  @Permission('setting', ['read'])
  @ApiOperation({ summary: 'Get all reward information' })
  async getRewardInfo(): Promise<RewardInfo[]> {
    return this.rewardService.getRewardInfo();
  }

  @Post()
  @Permission('setting', ['update'])
  @ApiOperation({ summary: 'Add or update reward information' })
  async addOrUpdateRewardInfo(
    @Body(new ZodValidationPipe(RewardInfoSchema)) dto: RewardInfoDto,
  ): Promise<RewardInfo[]> {
    return this.rewardService.addOrUpdateRewardInfo(dto);
  }

  @Delete(':name')
  @Permission('setting', ['update'])
  @ApiOperation({ summary: 'Delete reward information' })
  @ApiParam({ name: 'name', description: 'Reward method name' })
  async deleteRewardInfo(@Param('name') name: string): Promise<RewardInfo[]> {
    return this.rewardService.deleteRewardInfo(name);
  }
}
