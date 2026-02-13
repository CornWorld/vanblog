import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { initContract } from '@ts-rest/core';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { z } from 'zod';

import { ConfigService } from '../../config/config.service';
import { Perm } from '../auth/permissions.decorator';

import { SitemapService } from './sitemap.service';

const c = initContract();

// Sitemap contract definition (local to this controller until exposed in main contract)
// Note: paths are relative to controller path (sitemap), version is handled by NestJS versioning
const sitemapContract = c.router({
  generate: {
    method: 'POST',
    path: '/generate',
    body: z.object({}).optional(),
    responses: { 200: z.object({ message: z.string() }) },
    summary: 'Generate sitemap',
  },
  status: {
    method: 'GET',
    path: '/status',
    responses: {
      200: z.object({
        enabled: z.boolean(),
        sitemapUrl: z.string(),
        lastGenerated: z.string().optional(),
      }),
    },
    summary: 'Get sitemap generation status',
  },
  urls: {
    method: 'GET',
    path: '/urls',
    responses: { 200: z.object({ urls: z.array(z.string()) }) },
    summary: 'Get sitemap URLs',
  },
});

@ApiTags('Sitemap')
@Controller({ path: 'sitemap', version: '2' })
export class SitemapController {
  constructor(
    private readonly sitemapService: SitemapService,
    private readonly configService: ConfigService,
  ) {}

  @TsRestHandler(sitemapContract.generate)
  @Perm('sitemap', ['generate'])
  @Post('generate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate sitemap' })
  @ApiResponse({ status: 200, description: '站点地图生成成功' })
  generateSitemap_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(sitemapContract.generate, async () => {
      await this.sitemapService.generateSitemapFn('手动触发');
      return { status: 200, body: { message: '站点地图生成成功' } };
    });
  }

  @TsRestHandler(sitemapContract.status)
  @Perm('sitemap', ['read'])
  @Get('status')
  @ApiOperation({ summary: 'Get sitemap generation status' })
  @ApiResponse({ status: 200, description: '获取状态成功' })
  getSitemapStatus_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(sitemapContract.status, () => {
      const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3000');
      const siteUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

      return {
        status: 200,
        body: {
          enabled: true,
          sitemapUrl: `${siteUrl}sitemap/sitemap.xml`,
        },
      };
    });
  }

  @TsRestHandler(sitemapContract.urls)
  @Perm('sitemap', ['read'])
  @Get('urls')
  @ApiOperation({ summary: 'Get sitemap URLs' })
  @ApiResponse({ status: 200, description: '获取 URL 列表成功' })
  getSitemapUrls_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(sitemapContract.urls, async () => {
      const urls = await this.sitemapService.getSiteUrls();
      return { status: 200, body: { urls } };
    });
  }
}
