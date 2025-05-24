import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LinkDto } from '../../types/meta/link.dto';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from '../../isr/provider/isr.provider';
import { MetaProvider } from '../provider/meta.provider';
import { config } from '../../common/config';
import { ApiToken } from '../../common/swagger/token';
import { Result } from 'src/common/result/Result';
@ApiTags('link')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/meta/link')
export class LinkMetaController {
  constructor(
    private readonly metaProvider: MetaProvider,
    private readonly isrProvider: ISRProvider,
  ) { }

  @Get()
  async get() {
    const data = await this.metaProvider.getLinks();
    return Result.ok(data).toObject();
  }

  @Put()
  async update(@Body() updateLinkDto: LinkDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const data = await this.metaProvider.addOrUpdateLink(updateLinkDto);
    this.isrProvider.activeLink('更新友链触发增量渲染！');
    return Result.ok(data).toObject();
  }

  @Post()
  async create(@Body() updateLinkDto: LinkDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const data = await this.metaProvider.addOrUpdateLink(updateLinkDto);
    this.isrProvider.activeLink('创建友链触发增量渲染！');
    return Result.ok(data).toObject();
  }
  @Delete('/:name')
  async delete(@Param('name') name: string) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, "演示站禁止修改此项！").toObject();
    }
    const data = await this.metaProvider.deleteLink(name);
    this.isrProvider.activeLink('删除友链触发增量渲染！');
    return Result.ok(data).toObject();
  }
}
