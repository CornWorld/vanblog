import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../guard/auth.guard';
import { config } from '../../../common/config';
import { TokenProvider } from '../provider/token.provider';
import { ApiToken } from '../../../common/swagger/token';
import { Result } from 'src/common/result/Result';

@ApiTags('token')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/token/')
export class TokenController {
  constructor(private readonly tokenProvider: TokenProvider) { }

  @Get('')
  async getAllApiTokens() {
    const data = await this.tokenProvider.getAllAPIToken();
    return Result.ok(data).toObject();
  }

  @Post()
  async createApiToken(@Body() body: { name: string }) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const data = await this.tokenProvider.createAPIToken(body.name);
    return Result.ok(data).toObject();
  }

  @Delete('/:id')
  async deleteApiTokenByName(@Param('id') id: string) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const data = await this.tokenProvider.disableAPITokenById(id);
    return Result.ok(data).toObject();
  }
}
