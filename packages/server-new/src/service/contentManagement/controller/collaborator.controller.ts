import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { config } from 'src/common/config';

import { AdminGuard } from '../../auth/guard/auth.guard';
import { MetaProvider } from '../../meta/provider/meta.provider';
import { ApiToken } from 'src/common/swagger/token';
import { TokenProvider } from '../../auth/provider/token.provider';

import { UserProvider } from '../../auth/provider/user.provider';
import { Collaborator } from 'src/types/collaborator/collaborator';
import { Result } from 'src/common/result/Result';

@ApiTags('collaborator')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/collaborator/')
export class CollaboratorController {
  constructor(
    private readonly userProvider: UserProvider,
    private readonly metaProvider: MetaProvider,
    private readonly tokenProvider: TokenProvider,
  ) { }
  @Get()
  async getAllCollaborators() {
    const data = await this.userProvider.getAllCollaborators();
    return Result.ok(data || []).toObject();
  }
  @Get('/list')
  async getAllCollaboratorsList() {
    const adminUser = {
      id: 0,
      username: 'admin',
      role: 'admin',
    };
    const data = await this.userProvider.getAllCollaborators(true);
    return Result.ok([adminUser, ...data]).toObject();
  }
  @Delete('/:id')
  async deleteCollaboratorById(@Param('id') id: number) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const data = await this.userProvider.deleteCollaborator(id);
    await this.tokenProvider.disableAllCollaborator();
    return Result.ok(data).toObject();
  }
  @Post()
  async createCollaborator(@Body() dto: Collaborator) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const data = await this.userProvider.createCollaborator(dto);
    return Result.ok(data).toObject();
  }
  @Put()
  async updateCollaborator(@Body() dto: Collaborator) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const data = await this.userProvider.updateCollaborator(dto);
    await this.tokenProvider.disableAllCollaborator();
    return Result.ok(data).toObject();
  }
}
