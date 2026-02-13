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
import { initContract } from '@ts-rest/core';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { dayjs } from '@vanblog/shared';
import { z } from 'zod';

import { ConfigService } from '../../config/config.service';
import { Perm } from '../auth/permissions.decorator';

import { RssService } from './rss.service';

const c = initContract();

// RSS contract definition (local to this controller until exposed in main contract)
const rssContract = c.router({
  generateRss: {
    method: 'POST',
    path: '/rss/generate',
    body: z.object({}),
    responses: {
      201: z.object({ message: z.string() }),
    },
    summary: 'Generate RSS feed',
  },
  getRssStatus: {
    method: 'GET',
    path: '/rss/status',
    responses: {
      200: z.object({
        enabled: z.boolean(),
        lastGenerated: z.string().optional(),
        feedUrls: z.object({
          xml: z.string(),
          json: z.string(),
          atom: z.string(),
        }),
      }),
    },
    summary: 'Get RSS generation status',
  },
  getRssJson: {
    method: 'GET',
    path: '/v2/rss/json',
    responses: {
      200: z.object({ items: z.array(z.any()) }),
    },
    summary: 'Get RSS feed in JSON',
  },
  getRssXml: {
    method: 'GET',
    path: '/v2/rss/xml',
    responses: {
      200: z.string(),
    },
    summary: 'Get RSS feed in XML',
  },
  getRssAtom: {
    method: 'GET',
    path: '/v2/rss/atom',
    responses: {
      200: z.string(),
    },
    summary: 'Get RSS feed in Atom',
  },
});

@ApiTags('RSS')
@Controller()
export class RssController {
  constructor(
    private readonly rssService: RssService,
    private readonly configService: ConfigService,
  ) {}

  // RSS Generation (Admin endpoint)
  @TsRestHandler(rssContract.generateRss)
  @Perm('rss', ['generate'])
  @Post('rss/generate')
  @ApiOperation({ summary: 'Generate RSS feed' })
  @ApiResponse({ status: 201, description: 'RSS generated successfully' })
  generateRss_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(rssContract.generateRss, async () => {
      try {
        await this.rssService.generateRssFeedFn('手动触发');
        return { status: 201, body: { message: 'RSS 订阅源生成成功' } };
      } catch (_e) {
        throw new InternalServerErrorException('RSS 生成失败');
      }
    });
  }

  // RSS Status (Admin endpoint)
  @TsRestHandler(rssContract.getRssStatus)
  @Perm('rss', ['read'])
  @Get('rss/status')
  @ApiOperation({ summary: 'Get RSS status' })
  @ApiResponse({ status: 200, description: 'RSS status' })
  getRssStatus_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(rssContract.getRssStatus, async () => {
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

        return { status: 200, body: { enabled: true, lastGenerated, feedUrls } };
      } catch (_e) {
        throw new InternalServerErrorException('获取 RSS 状态失败');
      }
    });
  }

  /**
   * Get RSS XML feed (public endpoint)
   * Route: /v2/rss/xml (excluded from /api global prefix)
   */
  @TsRestHandler(rssContract.getRssXml)
  @Get('rss/xml')
  @ApiOperation({ summary: 'Get RSS feed in XML format' })
  @ApiResponse({ status: 200, description: 'RSS XML feed' })
  getRssXml_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(rssContract.getRssXml, async () => {
      const staticPath = this.configService.static.path;
      const rssPath = path.join(staticPath, 'rss', 'feed.xml');

      try {
        const content = await fs.readFile(rssPath, 'utf-8');
        return { status: 200, body: content };
      } catch {
        throw new NotFoundException('RSS XML feed not found');
      }
    });
  }

  /**
   * Get RSS JSON feed (public endpoint)
   * Route: /v2/rss/json (excluded from /api global prefix)
   */
  @TsRestHandler(rssContract.getRssJson)
  @Get('rss/json')
  @ApiOperation({ summary: 'Get RSS feed in JSON format' })
  @ApiResponse({ status: 200, description: 'RSS JSON feed' })
  getRssJson_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(rssContract.getRssJson, async () => {
      const staticPath = this.configService.static.path;
      const rssPath = path.join(staticPath, 'rss', 'feed.json');

      try {
        const content = await fs.readFile(rssPath, 'utf-8');
        const parsed = JSON.parse(content) as unknown[];
        return { status: 200, body: { items: parsed } };
      } catch {
        throw new NotFoundException('RSS JSON feed not found');
      }
    });
  }

  /**
   * Get RSS Atom feed (public endpoint)
   * Route: /v2/rss/atom (excluded from /api global prefix)
   */
  @TsRestHandler(rssContract.getRssAtom)
  @Get('rss/atom')
  @ApiOperation({ summary: 'Get RSS feed in Atom format' })
  @ApiResponse({ status: 200, description: 'RSS Atom feed' })
  getRssAtom_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(rssContract.getRssAtom, async () => {
      const staticPath = this.configService.static.path;
      const rssPath = path.join(staticPath, 'rss', 'atom.xml');

      try {
        const content = await fs.readFile(rssPath, 'utf-8');
        return { status: 200, body: content };
      } catch {
        throw new NotFoundException('RSS Atom feed not found');
      }
    });
  }
}
