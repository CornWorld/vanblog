import { Controller, Get, Post, HttpCode, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ConfigService } from '../../config/config.service';
import { Perm } from '../auth/permissions.decorator';

import { SitemapService } from './sitemap.service';

@ApiTags('Sitemap')
@Controller({ path: 'sitemap', version: '2' })
export class SitemapController {
  constructor(
    private readonly sitemapService: SitemapService,
    private readonly configService: ConfigService,
  ) {}

  @Perm('sitemap', ['generate'])
  @Post('generate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate sitemap' })
  @ApiResponse({ status: 200, description: '站点地图生成成功' })
  async generateSitemap(): Promise<{ message: string }> {
    await this.sitemapService.generateSitemapFn('手动触发');
    return { message: '站点地图生成成功' };
  }

  @Perm('sitemap', ['read'])
  @Get('status')
  @ApiOperation({ summary: 'Get sitemap generation status' })
  @ApiResponse({ status: 200, description: '获取状态成功' })
  getSitemapStatus(): { enabled: boolean; sitemapUrl: string } {
    const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3000');
    const siteUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    return {
      enabled: true,
      sitemapUrl: `${siteUrl}sitemap/sitemap.xml`,
    };
  }

  @Perm('sitemap', ['read'])
  @Get('urls')
  @ApiOperation({ summary: 'Get sitemap URLs' })
  @ApiResponse({ status: 200, description: '获取 URL 列表成功' })
  async getSitemapUrls(
    @Query('page') _page?: number,
    @Query('pageSize') _pageSize?: number,
  ): Promise<{ urls: string[] }> {
    const urls = await this.sitemapService.getSiteUrls();
    return { urls };
  }
}
