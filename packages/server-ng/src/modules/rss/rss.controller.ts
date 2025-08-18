import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/permissions.decorator';

import { RssService } from './rss.service';

@ApiTags('rss')
@Controller({ path: 'rss', version: '2' })
export class RssController {
  constructor(private readonly rssService: RssService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('rss', ['generate'])
  @ApiBearerAuth()
  @ApiOperation({ summary: '手动生成 RSS 订阅源' })
  async generateRss(): Promise<{ message: string }> {
    await this.rssService.generateRssFeedFn('手动触发');
    return { message: 'RSS 订阅源生成成功' };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('rss', ['read'])
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取 RSS 生成状态' })
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
    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
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
