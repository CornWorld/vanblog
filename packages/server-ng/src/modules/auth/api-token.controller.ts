import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

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
}
