import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';

import { RssController } from './rss.controller';
import { RssService } from './rss.service';

// Narrow, explicit context interface used by this plugin to avoid `any` usage
import type { Database } from '../../src/database/connection';
import type { HookService } from '../../src/modules/plugin/services/hook.service';
import type { MarkdownService } from '../../src/shared/services/markdown.service';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

export interface RssPluginConfig {
  debounceTime: number;
  includeFullContent: boolean;
  maxItems: number;
  customStyles: boolean;
}

export interface RssPluginContext {
  database: Database;
  config: ConfigService;
  services: {
    markdown: MarkdownService;
    hook: HookService;
    pluginRegistry: {
      register: (
        pluginName: string,
        provider: {
          getConfig: () => Promise<RssPluginConfig>;
          updateConfig: (config: RssPluginConfig) => Promise<void>;
          getStatus: () => Promise<{
            enabled: boolean;
            lastGenerated: Date | null;
            feedsAvailable: string[];
          }>;
        },
      ) => void;
      getData: (pluginName: string, key: string) => Promise<RssPluginConfig | null>;
      setData: (pluginName: string, key: string, config: RssPluginConfig) => Promise<void>;
    };
  };
  router: {
    get: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => void;
    post: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => void;
  };
}

/**
 * RSS 插件 - 为 VanBlog 提供 RSS 订阅功能
 *
 * 功能：
 * - 生成 RSS 2.0、Atom 1.0、JSON Feed 1.0 格式的订阅源
 * - 支持文章内容的 Markdown 渲染
 * - 支持自定义订阅源配置
 * - 提供防抖机制避免频繁重建
 */
@Injectable()
export class RssPlugin implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('rss-plugin');
  private rssService!: RssService;
  private controller!: RssController;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly context: RssPluginContext) {
    this.logger.log('RSS plugin initializing...');
  }

  onModuleInit(): void {
    // 初始化服务（与 RssService 构造签名保持一致）
    this.rssService = new RssService(
      this.context.database,
      this.context.config,
      this.context.services.markdown,
      this.context.services.hook,
      this.context.services.pluginRegistry,
      this.logger,
    );

    // 初始化控制器
    this.controller = new RssController(this.rssService);

    // 注册路由
    this.registerRoutes();

    // 注册钩子
    this.registerHooks();

    // 注册插件数据提供者
    this.registerProviders();

    // 初始生成 RSS（立即触发异步生成）
    this.rssService.generateRssFeed('插件启动', 0);

    this.logger.log('RSS plugin initialized successfully');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.logger.log('RSS plugin destroyed');
  }

  private registerRoutes(): void {
    const { router } = this.context;

    // 注册公开路由
    router.get('/rss/feed.xml', async (req, res) => this.controller.getRssFeed(req, res));
    router.get('/rss/feed.json', async (req, res) => this.controller.getJsonFeed(req, res));
    router.get('/rss/atom.xml', async (req, res) => this.controller.getAtomFeed(req, res));

    this.logger.debug('RSS routes registered');
  }

  private registerHooks(): void {
    const { hook } = this.context.services;

    // 当文章变化时重新生成 RSS
    hook.addAction('article|afterCreate', () => {
      this.scheduleRssRegeneration('文章创建');
    });

    hook.addAction('article|afterUpdate', () => {
      this.scheduleRssRegeneration('文章更新');
    });

    hook.addAction('article|afterDelete', () => {
      this.scheduleRssRegeneration('文章删除');
    });

    // 当站点信息变化时重新生成
    hook.addAction('setting|afterUpdate', (...args: unknown[]) => {
      const setting = (args[0] ?? {}) as { key?: string };
      const siteRelatedKeys = ['siteName', 'siteDesc', 'baseUrl', 'author', 'authorEmail'];
      if (typeof setting.key === 'string' && siteRelatedKeys.includes(setting.key)) {
        this.scheduleRssRegeneration('站点信息更新');
      }
    });

    this.logger.debug('RSS hooks registered');
  }

  private registerProviders(): void {
    // 注册插件配置提供者
    this.context.services.pluginRegistry.register('rss-plugin', {
      getConfig: async () => this.getPluginConfig(),
      updateConfig: async (config: RssPluginConfig) => this.updatePluginConfig(config),
      getStatus: async () =>
        Promise.resolve({
          enabled: true,
          lastGenerated: this.rssService.getLastGeneratedTime(),
          feedsAvailable: ['rss2', 'atom', 'json'],
        }),
    });

    // 在 bootstrap 响应中添加 RSS 信息（避免 any）
    this.context.services.hook.addFilter('bootstrap|transformResponse', (value: unknown) => {
      if (value != null && typeof value === 'object') {
        const response = value as Record<string, unknown>;
        const extensions = (response.extensions as Record<string, unknown> | undefined) ?? {};
        extensions['rss'] = {
          enabled: true,
          feeds: {
            rss2: '/rss/feed.xml',
            atom: '/rss/atom.xml',
            json: '/rss/feed.json',
          },
        };
        response.extensions = extensions;
        return response as typeof value;
      }
      return value;
    });
  }

  private scheduleRssRegeneration(reason: string): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    // 防抖 3 分钟
    this.timer = setTimeout(
      () => {
        this.rssService.generateRssFeed(reason);
      },
      3 * 60 * 1000,
    );
  }

  private async getPluginConfig(): Promise<RssPluginConfig> {
    const stored = await this.context.services.pluginRegistry.getData('rss-plugin', 'config');
    return (
      stored ?? {
        debounceTime: 180000, // 3 minutes
        includeFullContent: true,
        maxItems: 50,
        customStyles: true,
      }
    );
  }

  private async updatePluginConfig(config: RssPluginConfig): Promise<void> {
    await this.context.services.pluginRegistry.setData('rss-plugin', 'config', config);
  }
}

// 导出插件
export default RssPlugin;
