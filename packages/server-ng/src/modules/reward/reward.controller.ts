import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RewardService, RewardInfo } from './reward.service';
import { RewardInfoDto } from './dto/reward-info.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

@ApiTags('reward')
@Controller('api/admin/reward')
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  @Get()
  @ApiOperation({ summary: 'Get all reward information' })
  async getRewardInfo(): Promise<RewardInfo[]> {
    return this.rewardService.getRewardInfo();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add or update reward information' })
  async addOrUpdateRewardInfo(@Body() dto: RewardInfoDto): Promise<RewardInfo[]> {
    return this.rewardService.addOrUpdateRewardInfo(dto);
  }

  @Delete(':name')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete reward information' })
  @ApiParam({ name: 'name', description: 'Reward method name' })
  async deleteRewardInfo(@Param('name') name: string): Promise<RewardInfo[]> {
    return this.rewardService.deleteRewardInfo(name);
  }
}
