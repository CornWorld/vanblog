import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';

import { ConfigService } from '../../config/config.service';
import { Perm } from '../auth/permissions.decorator';

import { RssService } from './rss.service';

@ApiTags('RSS')
@Controller({ path: 'rss', version: '2' })
export class RssController {
  constructor(
    private readonly rssService: RssService,
    private readonly configService: ConfigService,
  ) {}

  @Post('generate')
  @Perm('rss', ['generate'])
  @ApiOperation({ summary: '手动生成 RSS 订阅源' })
  @ApiResponse({
    status: 201,
    description: 'RSS生成任务已启动',
    type: Object,
  })
  async generateRss(): Promise<{ message: string }> {
    await this.rssService.generateRssFeedFn('手动触发');
    return { message: 'RSS 订阅源生成成功' };
  }

  @Get('status')
  @Perm('rss', ['read'])
  @ApiOperation({ summary: '获取 RSS 生成状态' })
  @ApiResponse({
    status: 200,
    description: 'RSS状态获取成功',
    type: Object,
  })
  getRssStatus(): {
    enabled: boolean;
    lastGenerated?: string;
    feedUrls: {
      xml: string;
      json: string;
      atom: string;
    };
  } {
    // 这里可以添加更多状态信息
    const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3000');
    const siteUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    return {
      enabled: true,
      feedUrls: {
        xml: `${siteUrl}rss/feed.xml`,
        json: `${siteUrl}rss/feed.json`,
        atom: `${siteUrl}rss/atom.xml`,
      },
    };
  }
}
