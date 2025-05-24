import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';

import { ApiTags } from '@nestjs/swagger';

import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from '../provider/isr.provider';
import { SettingProvider } from '../../meta/provider/setting.provider';
import { ApiToken } from '../../../common/swagger/token';
import { WebsiteProvider } from 'src/provider/website/website.provider';
import { ISRSetting } from 'src/types/setting.dto';
import { Result } from 'src/common/result/Result';

@ApiTags('isr')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/isr')
export class ISRController {
  constructor(
    private readonly isrProvider: ISRProvider,
    private readonly settingProvider: SettingProvider,
    private readonly websiteProvider: WebsiteProvider,
  ) { }
  @Post()
  async activeISR() {
    await this.isrProvider.activeAll('手动触发 ISR', undefined, {
      forceActice: true,
    });
    return Result.ok("触发成功！").toObject();
  }
  @Put()
  async updateISRSetting(@Body() dto: ISRSetting) {
    await this.settingProvider.updateISRSetting(dto);
    await this.websiteProvider.restart('更新 ISR 配置');
    return Result.ok("更新成功！").toObject();
  }
  @Get()
  async getISRSetting() {
    const data = await this.settingProvider.getISRSetting();
    return Result.ok(data).toObject();
  }
}
