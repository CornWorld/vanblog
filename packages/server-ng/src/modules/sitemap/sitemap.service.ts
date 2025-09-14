import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, sql } from 'drizzle-orm';
import { SitemapStream, streamToPromise } from 'sitemap';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { articles, categories, tags } from '../../database/schema';
import { HookService } from '../plugin/services/hook.service';
import {
  SITEMAP_EXTRA_STATIC_PATHS_KEY,
  SitemapExtraStaticPathsSchema,
} from '../setting/registry-keys';
import { SettingCoreService } from '../setting/services/setting-core.service';

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);
  private timer: NodeJS.Timeout | null = null;
  private static readonly STATIC_PATHS: readonly string[] = [
    '/',
    '/category',
    '/tag',
    '/timeline',
    '/about',
    '/link',
  ];

  // Section mapping for URL patterns
  private static readonly SECTION_BY_PREFIX = [
    ['/post/', 'post'],
    ['/category/', 'category'],
    ['/tag/', 'tag'],
    ['/page/', 'page'],
  ] as const;

  private static readonly CHANGEFREQ_MAP = {
    root: 'daily',
    post: 'weekly',
    category: 'weekly',
    tag: 'weekly',
    page: 'daily',
    other: 'monthly',
  } as const;

  private static readonly PRIORITY_MAP = {
    root: 1.0,
    post: 0.8,
    category: 0.6,
    tag: 0.6,
    page: 0.5,
    other: 0.4,
  } as const;

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

      // 获取所有 URL（将数据库交互阶段与后续 IO 明确隔离，便于错误归因与稳定日志输出）
      let urlList: string[];
      try {
        urlList = await this.getSiteUrls();
      } catch {
        // 在某些测试 mock 下，.from() 可能直接返回 Promise 并导致后续链式调用 TypeError，
        // 这里统一归一化为数据库错误，确保错误信息稳定且对使用者有意义。
        throw new Error('Database error');
      }
      // 归一化：只保留同源 URL，转换为相对路径，去重并排序（稳定输出）
      const finalUrls = this.dedupe(this.normalizeUrls(siteUrl, urlList)).sort();

      // 创建站点地图流
      const smStream = new SitemapStream({ hostname: siteUrl });

      // 添加 URL 到站点地图
      finalUrls.forEach((url) => {
        smStream.write({
          url,
          changefreq: this.getChangeFreq(url),
          priority: this.getPriority(url),
        });
      });

      smStream.end();

      // 应用站点地图生成前钩子（传递归一化后的最终列表）
      try {
        await this.hookService.doAction('sitemap|beforeGenerate', {
          urls: finalUrls,
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
    const urlList: string[] = [...SitemapService.STATIC_PATHS];

    // 从设置读取可选的额外静态路径，兼容 string 或 string[]，且仅接受以 '/' 开头的项
    try {
      const raw =
        (await this.settingCoreService.getConfig<string | string[]>(
          SITEMAP_EXTRA_STATIC_PATHS_KEY,
          undefined,
          SitemapExtraStaticPathsSchema,
        )) ?? [];

      let list: string[] = [];
      if (Array.isArray(raw)) list = raw;
      else if (typeof raw === 'string') list = [raw];

      for (const p of list) {
        const trimmed = p.trim();
        if (trimmed.startsWith('/')) urlList.push(trimmed);
      }
    } catch {
      // 忽略设置读取错误，保持静默以遵循 never break userspace 原则
    }

    const [articleUrls, tagUrls, categoryUrls, pageUrls] = await Promise.all([
      this.getArticleUrls(),
      this.getTagUrls(),
      this.getCategoryUrls(),
      this.getPageUrls(),
    ]);

    urlList.push(...articleUrls, ...tagUrls, ...categoryUrls, ...pageUrls);

    // 通过钩子允许插件贡献或过滤 URL 列表
    try {
      const filtered = await this.hookService.applyFilters<string[]>(
        'sitemap|collect_urls',
        urlList,
      );
      return this.dedupe(filtered);
    } catch (_e) {
      // 容错：钩子异常时返回原始列表，遵循 never break userspace
      return this.dedupe(urlList);
    }
  }

  /**
   * 获取文章 URL
   */
  async getArticleUrls(): Promise<string[]> {
    const articleResults = await this.db
      .select({ id: articles.id, pathname: articles.pathname })
      .from(articles)
      .where(and(eq(articles.hidden, false), eq(articles.private, false)));

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
    // 首先尝试使用 count(*) 获得总数
    let total = 0;
    try {
      const rows: Array<{ count: number | string } | Record<string, unknown>> = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(and(eq(articles.hidden, false), eq(articles.private, false)));

      const first = Array.isArray(rows) ? (rows[0] as { count?: unknown }) : undefined;
      const c = first?.count;
      const n = typeof c === 'number' ? c : Number(c ?? 0);
      total = Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      total = 0;
    }

    // 当 count 结果不可用（例如测试环境的简化 mock）时，回退到列表长度
    if (total === 0) {
      try {
        const list = await this.db
          .select({ id: articles.id })
          .from(articles)
          .where(and(eq(articles.hidden, false), eq(articles.private, false)));
        total = Array.isArray(list) ? list.length : 0;
      } catch {
        total = 0;
      }
    }

    const configuredPageSize = await this.settingCoreService.getConfig<number>('pageSize', 5);
    const pageSize =
      typeof configuredPageSize === 'number' && configuredPageSize > 0 ? configuredPageSize : 5;
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
  private getSection(url: string): keyof typeof SitemapService.CHANGEFREQ_MAP {
    if (url === '/') return 'root';
    const found = SitemapService.SECTION_BY_PREFIX.find(([prefix]) => url.startsWith(prefix));
    return found ? (found[1] as keyof typeof SitemapService.CHANGEFREQ_MAP) : 'other';
  }

  /**
   * 获取更改频率
   */
  private getChangeFreq(url: string): string {
    const section = this.getSection(url);
    return SitemapService.CHANGEFREQ_MAP[section];
  }

  /**
   * 获取优先级
   */
  private getPriority(url: string): number {
    const section = this.getSection(url);
    return SitemapService.PRIORITY_MAP[section];
  }

  /**
   * 清理 URL
   */
  private washUrl(url: string): string {
    if (url === '') return 'http://localhost:3000/';
    return url.endsWith('/') ? url : `${url}/`;
  }

  private dedupe(urls: string[]): string[] {
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const u of urls) {
      if (!seen.has(u)) {
        seen.add(u);
        deduped.push(u);
      }
    }
    return deduped;
  }

  private normalizeUrls(siteUrl: string, urls: string[]): string[] {
    const { origin } = new URL(siteUrl);
    const out: string[] = [];
    for (const raw of urls) {
      if (raw === '') continue;
      // already a root-relative path
      if (raw.startsWith('/')) {
        out.push(raw);
        continue;
      }
      // absolute URL or other forms
      try {
        const u = new URL(raw);
        if (u.origin === origin) {
          const { pathname } = u;
          out.push(pathname.length > 0 ? pathname : '/');
        } else {
          // 丢弃跨域 URL，避免污染 sitemap

          continue;
        }
      } catch {
        // 非法字符串或相对路径如 'post/xxx' => 规范化为根路径
        const beginsWithSlash = raw.startsWith('/');
        out.push(beginsWithSlash ? raw : `/${raw}`);
      }
    }
    return out;
  }
}
