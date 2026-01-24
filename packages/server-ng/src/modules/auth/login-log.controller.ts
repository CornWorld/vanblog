import { Controller, Get, Query, ParseBooleanPipe, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

import { LoginLogService } from './login-log.service';

/**
 * Login Log Controller
 *
 * Provides endpoints for retrieving and managing login logs.
 */
@ApiTags('auth')
@Controller({ path: 'auth', version: '2' })
export class LoginLogController {
  constructor(private readonly loginLogService: LoginLogService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get login logs' })
  @ApiResponse({
    status: 200,
    description: 'Returns login logs',
    type: [Object],
  })
  @ApiQuery({ name: 'username', required: false, type: String })
  @ApiQuery({ name: 'success', required: false, type: Boolean })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getLogs(
    @Query('username') username?: string,
    @Query('success', new DefaultValuePipe(undefined), ParseBooleanPipe) success?: boolean,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.loginLogService.getLogs({
      username,
      success,
      startDate,
      endDate,
    });
  }

  @Get('logs/failed-attempts/by-username')
  @ApiOperation({ summary: 'Get failed login attempts by username' })
  @ApiResponse({
    status: 200,
    description: 'Returns count of failed login attempts',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of failed attempts' },
      },
    },
  })
  @ApiQuery({ name: 'username', required: true, type: String })
  @ApiQuery({ name: 'cutoffMinutes', required: false, type: Number, example: 30 })
  async getFailedAttemptsByUsername(
    @Query('username') username: string,
    @Query('cutoffMinutes', new DefaultValuePipe(30), ParseIntPipe) cutoffMinutes: number,
  ) {
    const count = await this.loginLogService.getRecentFailedAttempts(username, cutoffMinutes);
    return { count };
  }

  @Get('logs/failed-attempts/by-ip')
  @ApiOperation({ summary: 'Get failed login attempts by IP' })
  @ApiResponse({
    status: 200,
    description: 'Returns count of failed login attempts',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of failed attempts' },
      },
    },
  })
  @ApiQuery({ name: 'ip', required: true, type: String })
  @ApiQuery({ name: 'cutoffMinutes', required: false, type: Number, example: 30 })
  async getFailedAttemptsByIp(
    @Query('ip') ip: string,
    @Query('cutoffMinutes', new DefaultValuePipe(30), ParseIntPipe) cutoffMinutes: number,
  ) {
    const count = await this.loginLogService.getRecentFailedAttemptsByIp(ip, cutoffMinutes);
    return { count };
  }
}
