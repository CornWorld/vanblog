import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from '../../isr/provider/isr.provider';

import { config } from '../../../common/config';
import { SettingProvider } from '../provider/setting.provider';
import { MenuSetting } from '../../../types/setting.dto';
import { ApiToken } from '../../../common/swagger/token';
import { Result } from 'src/common/result/Result';
@ApiTags('menu')
@ApiToken
@UseGuards(...AdminGuard)
@Controller('/api/admin/meta/menu')
export class MenuMetaController {
  constructor(
    private readonly settingProvider: SettingProvider,
    private readonly isrProvider: ISRProvider,
  ) { }

  @Get()
  async get() {
    const data = await this.settingProvider.getMenuSetting();
    return Result.ok(data).toObject();
  }

  @Put()
  async update(@Body() dto: MenuSetting) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    await this.settingProvider.updateMenuSetting(dto);
    const data = await this.isrProvider.activeAll('更新导航栏配置触发增量渲染！');
    return Result.ok(data).toObject();
  }
}
