import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SocialDto, SocialType } from '../../../types/meta/social.dto';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from '../../isr/provider/isr.provider';
import { MetaProvider } from '../provider/meta.provider';
import { config } from '../../../common/config';
import { WebsiteProvider } from 'src/provider/website/website.provider';
import { ApiToken } from '../../../common/swagger/token';
import { Result } from 'src/common/result/Result';
@ApiTags('social')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/meta/social')
export class SocialMetaController {
  constructor(
    private readonly metaProvider: MetaProvider,
    private readonly isrProvider: ISRProvider,
    private readonly websiteProvider: WebsiteProvider,
  ) { }

  @Get()
  async get() {
    const data = await this.metaProvider.getSocials();
    return Result.ok(data).toObject();
  }
  @Get('/types')
  async getTypes() {
    const data = await this.metaProvider.getSocialTypes();
    return Result.ok(data).toObject();
  }

  @Put()
  async update(@Body() updateDto: SocialDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const data = await this.metaProvider.addOrUpdateSocial(updateDto);
    this.isrProvider.activeAll('更新联系方式触发增量渲染！');
    return Result.ok(data).toObject();
  }

  @Post()
  async create(@Body() updateDto: SocialDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const data = await this.metaProvider.addOrUpdateSocial(updateDto);
    this.isrProvider.activeAll('创建联系方式触发增量渲染！');
    return Result.ok(data).toObject();
  }

  @Delete('/:type')
  async delete(@Param('type') type: SocialType) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const data = await this.metaProvider.deleteSocial(type);
    this.isrProvider.activeAll('删除联系方式触发增量渲染！');
    return Result.ok(data).toObject();
  }
}
