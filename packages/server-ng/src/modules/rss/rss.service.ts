import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc } from 'drizzle-orm';
import { Feed } from 'feed';

import { DATABASE_CONNECTION } from '../../database';
import { articles, siteMeta } from '../../database/schema';
import { MarkdownService } from '../../shared/services/markdown.service';
import { safeParseJson, dataSchemas } from '../../shared/zod';
import { HookService } from '../plugin/services/hook.service';

import type { Database } from '../../database/connection';

@Injectable()
export class RssService {
  private readonly logger = new Logger(RssService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly markdownService: MarkdownService,
    private readonly hookService: HookService,
  ) {}

  /**
   * 生成 RSS 订阅源（带防抖）
   */
  generateRssFeed(info?: string, delay?: number): void {
    // 生成 RSS 订阅需要遍历全部文章数据，所以防抖时间长一点
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timer = setTimeout(
      () => {
        void this.generateRssFeedFn(info);
      },
      delay ?? 3 * 60 * 1000, // 默认 3 分钟防抖
    );
  }

  /**
   * 立即生成 RSS 订阅源
   */
  async generateRssFeedFn(info?: string): Promise<void> {
    this.logger.log(`${info ?? ''}重新生成 RSS 订阅`);
    try {
      // 获取所有公开文章
      const articleResults = await this.db
        .select()
        .from(articles)
        .where(and(eq(articles.hidden, false), eq(articles.private, false)))
        .orderBy(desc(articles.createdAt));

      // 获取站点元数据和设置数据
      const siteMetaResults = await this.db.select().from(siteMeta);
      const siteData = siteMetaResults.reduce<Record<string, string | undefined>>((acc, meta) => {
        const parsedValue = safeParseJson(meta.value, dataSchemas.genericObject);
        acc[meta.key] = typeof parsedValue === 'string' ? parsedValue : (meta.value ?? undefined);
        return acc;
      }, {});

      // 构建站点信息
      const siteInfo = {
        siteName: siteData.siteName ?? 'VanBlog',
        siteDesc: siteData.siteDesc ?? 'A simple blog',
        baseUrl: siteData.baseUrl ?? 'http://localhost:3000',
        author: siteData.author ?? 'Admin',
        siteLogo: siteData.siteLogo ?? '',
        favicon: siteData.favicon ?? '',
        authorLogo: siteData.authorLogo ?? '',
      };

      // 获取作者邮箱
      let email = process.env.EMAIL ?? siteData.authorEmail ?? undefined;
      const walineConfig =
        typeof siteData.waline === 'string'
          ? safeParseJson(siteData.waline, dataSchemas.genericObject)
          : null;
      if (
        walineConfig !== null &&
        typeof walineConfig === 'object' &&
        'authorEmail' in walineConfig
      ) {
        email = email !== '' ? email : (walineConfig.authorEmail as string);
      }

      const author = {
        name: siteInfo.author,
        email,
        link: siteInfo.baseUrl,
      };

      const siteUrl = this.washUrl(siteInfo.baseUrl);
      const { favicon: faviconUrl, siteLogo: siteLogoUrl, authorLogo } = siteInfo;

      let favicon = `${siteUrl}logo.svg`;
      if (faviconUrl !== '') {
        favicon = faviconUrl;
      } else if (siteLogoUrl !== '') {
        favicon = siteLogoUrl;
      } else if (authorLogo !== '') {
        favicon = authorLogo;
      }

      let siteLogo = `${siteUrl}logo.svg`;
      if (siteLogoUrl !== '') {
        siteLogo = siteLogoUrl;
      } else if (authorLogo !== '') {
        siteLogo = authorLogo;
      } else if (faviconUrl !== '') {
        siteLogo = faviconUrl;
      }

      const date = new Date();
      const feed = new Feed({
        title: siteInfo.siteName,
        description: siteInfo.siteDesc,
        id: siteUrl,
        link: siteUrl,
        language: 'zh-cn',
        image: siteLogo,
        favicon,
        copyright: `All rights reserved ${date.getFullYear()}, ${siteInfo.author}`,
        updated: date,
        generator: 'Feed for VanBlog Server-NG',
        feedLinks: {
          rss2: `${siteUrl}rss/feed.xml`, // xml format
          json: `${siteUrl}rss/feed.json`, // json format
        },
        author,
      });

      // 添加文章到 RSS
      for (const article of articleResults) {
        const url = `${siteUrl}post/${article.pathname ?? article.id}`;
        const category = {
          name: article.category ?? 'Uncategorized',
          domain: `${siteUrl}/category/${article.category ?? 'uncategorized'}`,
        };

        const content = article.private ? '此文章已加密' : article.content;

        const htmlContent = this.markdownService.renderForRss(content);
        const description = this.markdownService.getDescription(content);

        const html = `<div class="markdown-body rss">
      <link rel="stylesheet" href="${siteUrl}markdown.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.5.1/katex.min.css">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.6.0/build/styles/default.min.css">
      ${htmlContent}</div>`;

        feed.addItem({
          title: article.title,
          id: url,
          link: url,
          description: this.markdownService.renderForRss(description),
          category: [category],
          content: html,
          author: [author],
          contributor: [author],
          date: new Date(article.createdAt),
          published: new Date(article.updatedAt !== '' ? article.updatedAt : article.createdAt),
        });
      }

      // 应用 RSS 生成钩子
      try {
        await this.hookService.doAction('rss|beforeGenerate', {
          feed,
          articles: articleResults,
          siteInfo,
        });
      } catch (error) {
        this.logger.error('Error in rss|beforeGenerate hook:', error);
      }

      // 写入 RSS 文件
      const staticPath = this.configService.get<string>('STATIC_PATH') ?? './static';
      const rssPath = path.join(staticPath, 'rss');

      try {
        await fs.access(rssPath);
      } catch {
        await fs.mkdir(rssPath, { recursive: true });
      }

      await fs.writeFile(path.join(rssPath, 'feed.json'), feed.json1());
      await fs.writeFile(path.join(rssPath, 'feed.xml'), feed.rss2());
      await fs.writeFile(path.join(rssPath, 'atom.xml'), feed.atom1());

      // 应用 RSS 生成完成钩子
      try {
        await this.hookService.doAction('rss|afterGenerate', {
          rssPath,
          files: ['feed.json', 'feed.xml', 'atom.xml'],
        });
      } catch (error) {
        this.logger.error('Error in rss|afterGenerate hook:', error);
      }

      this.logger.log('RSS 订阅生成完成');
    } catch (err) {
      this.logger.error('生成订阅源失败！');
      this.logger.error(JSON.stringify(err, null, 2));
    }
  }

  /**
   * 清理 URL
   */
  private washUrl(url: string): string {
    if (url === '') return 'http://localhost:3000/';
    return url.endsWith('/') ? url : `${url}/`;
  }
}
