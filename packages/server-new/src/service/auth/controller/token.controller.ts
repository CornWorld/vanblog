import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../guard/auth.guard';
import { config } from '../../../common/config';
import { TokenProvider } from '../provider/token.provider';
import { ApiToken } from '../../../common/swagger/token';

@ApiTags('token')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/token/')
export class TokenController {
  constructor(private readonly tokenProvider: TokenProvider) { }

  @Get('')
  async getAllApiTokens() {
    const data = await this.tokenProvider.getAllAPIToken();
    return {
      statusCode: 200,
      data,
    };
  }

  @Post()
  async createApiToken(@Body() body: { name: string }) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.tokenProvider.createAPIToken(body.name);
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/:id')
  async deleteApiTokenByName(@Param('id') id: string) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.tokenProvider.disableAPITokenById(id);
    return {
      statusCode: 200,
      data,
    };
  }
}
