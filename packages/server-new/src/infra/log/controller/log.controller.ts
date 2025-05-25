import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/service/auth/guard/auth.guard';
import { LogProvider } from '../provider/log.provider';
import { EventType } from '../types/types';
import { ApiToken } from 'src/common/swagger/token';
@ApiTags('log')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/log')
export class LogController {
  constructor(private readonly logProvider: LogProvider) { }

  @Get()
  async get(
    @Query('page') page: number,
    @Query('pageSize') pageSize: number,
    @Query('event') event: EventType,
  ) {
    // console.log(event, page, pageSize);
    const data = await this.logProvider.searchLog(page, pageSize, event);
    return {
      statusCode: 200,
      data,
    };
  }
}
