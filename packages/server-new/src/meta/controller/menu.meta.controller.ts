import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from 'src/provider/isr/isr.provider';

import { config } from '../../common/config';
import { SettingProvider } from '../provider/setting.provider';
import { MenuSetting } from '../../types/meta/setting.dto';
import { ApiToken } from '../../common/swagger/token';
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
    return {
      statusCode: 200,
      data,
    };
  }

  @Put()
  async update(@Body() dto: MenuSetting) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    await this.settingProvider.updateMenuSetting(dto);
    const data = await this.isrProvider.activeAll('更新导航栏配置触发增量渲染！');
    return {
      statusCode: 200,
      data,
    };
  }
}
