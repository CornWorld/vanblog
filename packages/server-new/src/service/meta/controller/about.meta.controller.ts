import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../auth/guard/auth.guard';
import { ISRProvider } from '../../isr/provider/isr.provider';
import { MetaProvider } from '../provider/meta.provider';
import { config } from '../../../common/config';
import { ApiToken } from '../../../common/swagger/token';
import { Result } from 'src/common/result/Result';
@ApiTags('about')
@ApiToken
@UseGuards(...AdminGuard)
@Controller('/api/admin/meta/about')
export class AboutMetaController {
  constructor(
    private readonly metaProvider: MetaProvider,
    private readonly isrProvider: ISRProvider,
  ) { }

  @Get()
  async getAbout() {
    const data = await this.metaProvider.getAbout();
    return Result.ok(data).toObject();
  }

  @Put()
  async updateAbout(@Body() updateAboutDto: { content: string }) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const data = await this.metaProvider.updateAbout(updateAboutDto.content);
    this.isrProvider.activeAbout('更新 about 触发增量渲染！');
    return Result.ok(data).toObject();
  }
}
