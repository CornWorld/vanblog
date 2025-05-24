import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RewardDto } from '../../../types/meta/reward.dto';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from '../../isr/provider/isr.provider';
import { MetaProvider } from '../provider/meta.provider';
import { config } from '../../../common/config';
import { ApiToken } from '../../../common/swagger/token';
import { Result } from 'src/common/result/Result';
@ApiTags('reward')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/meta/reward')
export class RewardMetaController {
  constructor(
    private readonly metaProvider: MetaProvider,
    private readonly isrProvider: ISRProvider,
  ) { }

  @Get()
  async get() {
    const data = await this.metaProvider.getRewards();
    return Result.ok(data).toObject();
  }

  @Put()
  async update(@Body() updateDto: RewardDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const data = await this.metaProvider.addOrUpdateReward(updateDto);
    this.isrProvider.activeAbout('更新打赏信息触发增量渲染！');
    return Result.ok(data).toObject();
  }

  @Post()
  async create(@Body() updateDto: RewardDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const data = await this.metaProvider.addOrUpdateReward(updateDto);
    this.isrProvider.activeAbout('新建打赏信息触发增量渲染！');
    return Result.ok(data).toObject();
  }

  @Delete('/:name')
  async delete(@Param('name') name: string) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const data = await this.metaProvider.deleteReward(name);
    this.isrProvider.activeAbout('删除打赏信息触发增量渲染！');
    return Result.ok(data).toObject();
  }
}
