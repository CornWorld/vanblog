import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

import { SitemapService } from './sitemap.service';

@ApiTags('sitemap')
@Controller({ path: 'sitemap', version: '2' })
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('sitemap', 'generate')
  @ApiBearerAuth()
  @ApiOperation({ summary: '手动生成站点地图' })
  @ApiResponse({ status: 200, description: '站点地图生成成功' })
  async generateSitemap(): Promise<{ message: string }> {
    await this.sitemapService.generateSitemapFn('手动触发');
    return { message: '站点地图生成成功' };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('sitemap', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取站点地图生成状态' })
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('sitemap', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取站点地图包含的所有 URL' })
  @ApiResponse({ status: 200, description: '获取 URL 列表成功' })
  async getSitemapUrls(): Promise<{ urls: string[] }> {
    const urls = await this.sitemapService.getSiteUrls();
    return { urls };
  }
}
