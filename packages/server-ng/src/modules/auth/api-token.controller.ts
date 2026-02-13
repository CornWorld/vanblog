import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { ApiTokenService } from './api-token.service';
import { Permission } from './permissions.decorator';

@ApiTags('Auth')
@Controller({ path: 'tokens', version: '2' })
export class ApiTokenController {
  constructor(private readonly apiTokenService: ApiTokenService) {}

  @Get()
  @Permission('user', ['read'])
  @ApiOperation({ summary: 'Get all API tokens' })
  @ApiResponse({ status: 200, description: 'Return all tokens' })
  async getAllTokens(): Promise<unknown> {
    return await this.apiTokenService.getAllTokens();
  }

  @Post()
  @Permission('user', ['create'])
  @ApiOperation({ summary: 'Create API token' })
  @ApiResponse({ status: 201, description: 'Token created' })
  async createToken(@Body() body: { name: string }): Promise<unknown> {
    return await this.apiTokenService.createToken(body.name);
  }

  @Delete(':id')
  @Permission('user', ['delete'])
  @ApiOperation({ summary: 'Delete API token' })
  @ApiResponse({ status: 200, description: 'Token deleted' })
  async deleteToken(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.apiTokenService.deleteToken(id);
    return { success };
  }

  @TsRestHandler(contract.getTokens)
  @Permission('user', ['read'])
  @Get()
  getTokens_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getTokens, async () => {
      const tokens = await this.apiTokenService.getAllTokens();
      return { status: 200, body: tokens };
    });
  }

  @TsRestHandler(contract.createToken)
  @Permission('user', ['create'])
  @Post()
  createToken_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createToken, async ({ body }) => {
      const token = await this.apiTokenService.createToken(body.name);
      return { status: 201, body: token };
    });
  }

  @TsRestHandler(contract.deleteToken)
  @Permission('user', ['delete'])
  @Delete()
  deleteToken_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteToken, async ({ params }) => {
      const { id } = params;
      const success = await this.apiTokenService.deleteToken(id);
      return { status: 200, body: { success } };
    });
  }
}
