import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { ApiTags } from '@nestjs/swagger';
import { config } from '../../common/config/index';
import { LayoutSetting, LoginSetting, StaticSetting, WalineSetting } from '../types/setting.dto';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from '../../isr/provider/isr.provider';
import { SettingProvider } from '../provider/setting.provider';
import { WalineProvider } from 'src/provider/waline/waline.provider';
import { ApiToken } from '../../common/swagger/token';
import { Result } from 'src/common/result/Result';

@ApiTags('setting')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/setting')
export class SettingController {
  constructor(
    private readonly settingProvider: SettingProvider,
    private readonly walineProvider: WalineProvider,
    private readonly isrProvider: ISRProvider,
  ) { }

  @Get('static')
  async getStaticSetting() {
    const res = await this.settingProvider.getStaticSetting();
    return Result.ok(res).toObject();
  }

  @Put('static')
  async updateStaticSetting(@Body() body: Partial<StaticSetting>) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const res = await this.settingProvider.updateStaticSetting(body);
    return Result.ok(res).toObject();
  }
  @Put('waline')
  async updateWalineSetting(@Body() body: WalineSetting) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const res = await this.settingProvider.updateWalineSetting(body);
    await this.walineProvider.restart('更新 waline 设置，');
    return Result.ok(res).toObject();
  }
  @Get('waline')
  async getWalineSetting() {
    if (config.demo && config.demo == 'true') {
      return Result.ok(null).toObject();
    }
    const res = await this.settingProvider.getWalineSetting();
    return Result.ok(res).toObject();
  }
  @Put('layout')
  async updateLayoutSetting(@Body() body: LayoutSetting) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改定制化设置！").toObject();
    }
    const res = await this.settingProvider.updateLayoutSetting(body);
    this.isrProvider.activeAll('更新 layout 设置');
    return Result.ok(res).toObject();
  }
  @Get('layout')
  async getLayoutSetting() {
    const res = await this.settingProvider.getLayoutSetting();
    return Result.ok(res).toObject();
  }
  @Put('login')
  async updateLoginSetting(@Body() body: LoginSetting) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改登录安全策略设置！").toObject();
    }
    const res = await this.settingProvider.updateLoginSetting(body);
    return Result.ok(res).toObject();
  }
  @Get('login')
  async getLoginSetting() {
    const res = await this.settingProvider.getLoginSetting();
    return Result.ok(res).toObject();
  }
}
