import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Perm } from '../auth/permissions.decorator';

import { SitemapService } from './sitemap.service';

@ApiTags('Sitemap')
@Controller({ path: 'sitemap', version: '2' })
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  @Post('generate')
  @Perm('sitemap', ['generate'])
  @ApiOperation({ summary: 'Generate sitemap' })
  @ApiResponse({ status: 200, description: '站点地图生成成功' })
  async generateSitemap(): Promise<{ message: string }> {
    await this.sitemapService.generateSitemapFn('手动触发');
    return { message: '站点地图生成成功' };
  }

  @Get('status')
  @Perm('sitemap', ['read'])
  @ApiOperation({ summary: 'Get sitemap generation status' })
  @ApiResponse({ status: 200, description: '获取状态成功' })
  getSitemapStatus(): {
    enabled: boolean;
    lastGenerated?: string;
    sitemapUrl: string;
  } {
    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
    const siteUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    return {
      enabled: true,
      sitemapUrl: `${siteUrl}sitemap/sitemap.xml`,
    };
  }

  @Get('urls')
  @Perm('sitemap', ['read'])
  @ApiOperation({ summary: 'Get sitemap URLs' })
  @ApiResponse({ status: 200, description: '获取 URL 列表成功' })
  async getSitemapUrls(): Promise<{ urls: string[] }> {
    const urls = await this.sitemapService.getSiteUrls();
    return { urls };
  }
}
