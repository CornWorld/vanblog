import * as fs from 'fs/promises';
import * as path from 'path';

import {
  Controller,
  Get,
  Post,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { dayjs } from '@vanblog/shared';

import { ConfigService } from '../../config/config.service';
import { Perm } from '../auth/permissions.decorator';

import { RssService } from './rss.service';

@ApiTags('RSS')
@Controller()
export class RssController {
  constructor(
    private readonly rssService: RssService,
    private readonly configService: ConfigService,
  ) {}

  @Perm('rss', ['generate'])
  @Post('rss/generate')
  @ApiOperation({ summary: 'Generate RSS feed' })
  @ApiResponse({ status: 201, description: 'RSS generated successfully' })
  async generateRss(): Promise<{ message: string }> {
    try {
      await this.rssService.generateRssFeedFn('手动触发');
      return { message: 'RSS 订阅源生成成功' };
    } catch (_e) {
      throw new InternalServerErrorException('RSS 生成失败');
    }
  }

  @Perm('rss', ['read'])
  @Get('rss/status')
  @ApiOperation({ summary: 'Get RSS status' })
  @ApiResponse({ status: 200, description: 'RSS status' })
  async getRssStatus(): Promise<{
    enabled: boolean;
    lastGenerated?: string;
    feedUrls: { xml: string; json: string; atom: string };
  }> {
    try {
      const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3000');
      const siteUrl =
        typeof baseUrl === 'string' && baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

      const feedUrls = {
        xml: `${siteUrl}rss/feed.xml`,
        json: `${siteUrl}rss/feed.json`,
        atom: `${siteUrl}rss/atom.xml`,
      };

      let lastGenerated: string | undefined = undefined;
      const staticPath = this.configService.static.path;
      const rssPath = path.join(staticPath, 'rss');
      try {
        const files = ['feed.xml', 'feed.json', 'atom.xml'];
        const stats = await Promise.all(
          files.map(async (f) => {
            try {
              const s = await fs.stat(path.join(rssPath, f));
              return s.mtime;
            } catch {
              return null;
            }
          }),
        );
        const times = stats.filter((t): t is Date => t instanceof Date);
        if (times.length > 0) {
          const [latest] = times.sort((a, b) => b.getTime() - a.getTime());
          lastGenerated = dayjs(latest).format();
        }
      } catch {
        // ignore
      }

      return { enabled: true, lastGenerated, feedUrls };
    } catch (_e) {
      throw new InternalServerErrorException('获取 RSS 状态失败');
    }
  }

  /**
   * Get RSS XML feed (public endpoint)
   * Route: /v2/rss/xml (excluded from /api global prefix)
   */
  @Get('rss/xml')
  @ApiOperation({ summary: 'Get RSS feed in XML format' })
  @ApiResponse({ status: 200, description: 'RSS XML feed' })
  async getRssXml(): Promise<{ statusCode: number; data: string }> {
    const staticPath = this.configService.static.path;
    const rssPath = path.join(staticPath, 'rss', 'feed.xml');

    try {
      const content = await fs.readFile(rssPath, 'utf-8');
      return { statusCode: 200, data: content };
    } catch {
      throw new NotFoundException('RSS XML feed not found');
    }
  }

  /**
   * Get RSS JSON feed (public endpoint)
   * Route: /v2/rss/json (excluded from /api global prefix)
   */
  @Get('rss/json')
  @ApiOperation({ summary: 'Get RSS feed in JSON format' })
  @ApiResponse({ status: 200, description: 'RSS JSON feed' })
  async getRssJson(): Promise<{ statusCode: number; data: { items: unknown[] } }> {
    const staticPath = this.configService.static.path;
    const rssPath = path.join(staticPath, 'rss', 'feed.json');

    try {
      const content = await fs.readFile(rssPath, 'utf-8');
      const parsed = JSON.parse(content) as unknown[];
      return { statusCode: 200, data: { items: parsed } };
    } catch {
      throw new NotFoundException('RSS JSON feed not found');
    }
  }

  /**
   * Get RSS Atom feed (public endpoint)
   * Route: /v2/rss/atom (excluded from /api global prefix)
   */
  @Get('rss/atom')
  @ApiOperation({ summary: 'Get RSS feed in Atom format' })
  @ApiResponse({ status: 200, description: 'RSS Atom feed' })
  async getRssAtom(): Promise<{ statusCode: number; data: string }> {
    const staticPath = this.configService.static.path;
    const rssPath = path.join(staticPath, 'rss', 'atom.xml');

    try {
      const content = await fs.readFile(rssPath, 'utf-8');
      return { statusCode: 200, data: content };
    } catch {
      throw new NotFoundException('RSS Atom feed not found');
    }
  }
}
