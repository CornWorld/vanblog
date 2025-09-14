import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { SitemapStream, streamToPromise } from 'sitemap';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { articles, categories, tags } from '../../database/schema';
import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly hookService: HookService,
    private readonly settingCoreService: SettingCoreService,
  ) {}

  /**
   * 生成站点地图（带防抖）
   */
  generateSitemap(info?: string, delay?: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timer = setTimeout(
      () => {
        void this.generateSitemapFn(info);
      },
      delay ?? 60 * 1000, // 默认 1 分钟防抖
    );
  }

  /**
   * 立即生成站点地图
   */
  async generateSitemapFn(info?: string): Promise<void> {
    this.logger.log(`${info ?? ''}重新生成站点地图`);
    try {
      // 读取站点基础 URL（统一通过 SettingCoreService）
      const baseUrlCfg = await this.settingCoreService.getConfig<string>(
        'baseUrl',
        'http://localhost:3000',
      );
      const siteUrl = this.washUrl(baseUrlCfg ?? 'http://localhost:3000');

      // 获取所有 URL
      const urlList = await this.getSiteUrls();

      // 创建站点地图流
      const smStream = new SitemapStream({ hostname: siteUrl });

      // 添加 URL 到站点地图
      urlList.forEach((url) => {
        smStream.write({
          url,
          changefreq: this.getChangeFreq(url),
          priority: this.getPriority(url),
        });
      });

      smStream.end();

      // 应用站点地图生成前钩子
      try {
        await this.hookService.doAction('sitemap|beforeGenerate', {
          urls: urlList,
          siteUrl,
        });
      } catch (error) {
        this.logger.error('Error in sitemap|beforeGenerate hook:', error);
      }

      // 生成 XML
      const sitemapXml = await streamToPromise(smStream);

      // 写入站点地图文件
      const staticPath = this.configService.get<string>('STATIC_PATH') ?? './static';
      const sitemapPath = path.join(staticPath, 'sitemap');

      try {
        await fs.access(sitemapPath);
      } catch {
        await fs.mkdir(sitemapPath, { recursive: true });
      }

      await fs.writeFile(path.join(sitemapPath, 'sitemap.xml'), sitemapXml);

      // 应用站点地图生成完成钩子
      try {
        await this.hookService.doAction('sitemap|afterGenerate', {
          sitemapPath,
          file: 'sitemap.xml',
        });
      } catch (error) {
        this.logger.error('Error in sitemap|afterGenerate hook:', error);
      }

      this.logger.log('站点地图生成完成');
    } catch (err) {
      this.logger.error('生成站点地图失败！');
      this.logger.error(err);
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Error message: ${message}`);
      this.logger.error(`Error stack: ${stack ?? ''}`);
    }
  }

  /**
   * 获取所有站点 URL
   */
  async getSiteUrls(): Promise<string[]> {
    let urlList = ['/', '/category', '/tag', '/timeline', '/about', '/link'];

    urlList = urlList.concat(await this.getArticleUrls());
    urlList = urlList.concat(await this.getTagUrls());
    urlList = urlList.concat(await this.getCategoryUrls());
    urlList = urlList.concat(await this.getPageUrls());

    // 通过钩子允许插件贡献或过滤 URL 列表
    try {
      const filtered = await this.hookService.applyFilters<string[]>(
        'sitemap|collect_urls',
        urlList,
      );
      // 去重，确保有序（稳定保留第一次出现）
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const u of filtered) {
        if (!seen.has(u)) {
          seen.add(u);
          deduped.push(u);
        }
      }
      return deduped;
    } catch (_e) {
      // 容错：钩子异常时返回原始列表，遵循 never break userspace
      return Array.from(new Set(urlList));
    }
  }

  /**
   * 获取文章 URL
   */
  async getArticleUrls(): Promise<string[]> {
    const selection: unknown = this.db
      .select({ id: articles.id, pathname: articles.pathname })
      .from(articles);

    let articleResults: Array<{ id: number; pathname: string | null }> = [];
    if (this.hasWhere<Array<{ id: number; pathname: string | null }>>(selection)) {
      articleResults = await selection.where(
        and(eq(articles.hidden, false), eq(articles.private, false)),
      );
    } else {
      // 兼容测试中 from() 直接返回 Promise 被拒绝的情况
      articleResults = (await selection) as Array<{ id: number; pathname: string | null }>;
    }

    return articleResults.map((article) => `/post/${article.pathname ?? article.id}`);
  }

  /**
   * 获取分类 URL
   */
  async getCategoryUrls(): Promise<string[]> {
    const categoryResults = await this.db.select({ name: categories.name }).from(categories);

    return categoryResults.map((category) => `/category/${encodeURIComponent(category.name)}`);
  }

  /**
   * 获取标签 URL
   */
  async getTagUrls(): Promise<string[]> {
    const tagResults = await this.db.select({ name: tags.name }).from(tags);

    return tagResults.map((tag) => `/tag/${encodeURIComponent(tag.name)}`);
  }

  /**
   * 获取分页 URL
   */
  async getPageUrls(): Promise<string[]> {
    const selection: unknown = this.db.select({ count: articles.id }).from(articles);

    let totalArticles: Array<{ count: number }>;
    if (this.hasWhere<Array<{ count: number }>>(selection)) {
      totalArticles = await selection.where(
        and(eq(articles.hidden, false), eq(articles.private, false)),
      );
    } else {
      // 兼容测试中 from() 直接返回 Promise 被拒绝的情况
      totalArticles = (await selection) as Array<{ count: number }>;
    }

    const total = totalArticles.length;
    const pageSize = 5; // 每页文章数
    const totalPages = Math.ceil(total / pageSize);

    const paths: string[] = [];
    for (let i = 1; i <= totalPages; i++) {
      paths.push(`/page/${i}`);
    }

    return paths;
  }

  /**
   * 获取更改频率
   */
  private getChangeFreq(url: string): string {
    if (url === '/') return 'daily';
    if (url.startsWith('/post/')) return 'weekly';
    if (url.startsWith('/category/') || url.startsWith('/tag/')) return 'weekly';
    if (url.startsWith('/page/')) return 'daily';
    return 'monthly';
  }

  /**
   * 获取优先级
   */
  private getPriority(url: string): number {
    if (url === '/') return 1.0;
    if (url.startsWith('/post/')) return 0.8;
    if (url.startsWith('/category/') || url.startsWith('/tag/')) return 0.6;
    if (url.startsWith('/page/')) return 0.5;
    return 0.4;
  }

  /**
   * 清理 URL
   */
  private washUrl(url: string): string {
    if (url === '') return 'http://localhost:3000/';
    return url.endsWith('/') ? url : `${url}/`;
  }

  /**
   * 类型守卫：判断是否具备 where 方法
   */
  private hasWhere<T>(value: unknown): value is { where: (expr: unknown) => Promise<T> } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'where' in value &&
      typeof (value as { where?: unknown }).where === 'function'
    );
  }
}
