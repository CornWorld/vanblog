import * as fs from 'fs/promises';
import * as path from 'path';

import { Controller, InternalServerErrorException } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { dayjs } from '@vanblog/shared';
import { rssContract } from '@vanblog/shared/dist/contracts/rss.contract.js';

import { ConfigService } from '../../config/config.service';
import { Perm } from '../auth/permissions.decorator';

import { RssService } from './rss.service';

@Controller()
export class RssController {
  constructor(
    private readonly rssService: RssService,
    private readonly configService: ConfigService,
  ) {}

  @TsRestHandler(rssContract.generateRss)
  @Perm('rss', ['generate'])
  generateRss(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(rssContract.generateRss, async () => {
      try {
        await this.rssService.generateRssFeedFn('手动触发');
        return { status: 201, body: { message: 'RSS 订阅源生成成功' } };
      } catch (_e) {
        throw new InternalServerErrorException('RSS 生成失败');
      }
    });
  }

  @TsRestHandler(rssContract.getRssStatus)
  @Perm('rss', ['read'])
  getRssStatus(): ReturnType<typeof tsRestHandler> {
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
        const staticPath = this.configService.static?.path ?? './static';
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
}
