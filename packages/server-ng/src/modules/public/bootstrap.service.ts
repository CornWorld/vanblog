import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StatisticsService } from '../../shared/services/statistics.service';
import { CategoryService } from '../category/category.service';
import { CommentService } from '../comment/comment.service';
import { HookService } from '../plugin/services/hook.service';
import { PluginDataValidator } from '../plugin/services/plugin-data.validator';
import { PluginRegistryService } from '../plugin/services/plugin-registry.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { TagService } from '../tag/tag.service';

import type { PublicBootstrapResponseDto } from './bootstrap.dto';

@Injectable()
export class BootstrapService {
  constructor(
    private readonly configService: ConfigService,
    private readonly statisticsService: StatisticsService,
    private readonly settingCoreService: SettingCoreService,
    private readonly commentService: CommentService,
    private readonly tagService: TagService,
    private readonly categoryService: CategoryService,
    private readonly hookService: HookService,
    private readonly pluginRegistryService: PluginRegistryService,
    private readonly pluginDataValidator: PluginDataValidator,
  ) {}

  async getPublicBootstrap(): Promise<PublicBootstrapResponseDto> {
    // 插件钩子：生成前
    try {
      await this.hookService.doAction('bootstrap|beforeGenerate', {}, { action: 'public' });
    } catch {
      // ignore plugin errors
    }

    const results = await Promise.allSettled([
      this.getAllTags(),
      this.statisticsService.getOverallStatistics(),
      this.settingCoreService.getSiteInfo(),
      this.settingCoreService.getNavigation(),
      this.settingCoreService.getFriendLinks(),
      this.getWalineConfig(),
      this.getAllCategories(),
      this.statisticsService.getTotalPublishedWordCount(),
      this.pluginRegistryService.getAllPublicData(),
    ]);

    const [
      tags,
      overall,
      siteInfo,
      navigation,
      friendLinks,
      walineSettings,
      categories,
      totalWordCount,
      pluginData,
    ] = results;

    const resolvedPluginData: Record<string, unknown> =
      pluginData.status === 'fulfilled' ? pluginData.value : {};

    // 校验与规范化插件数据
    const validatedExtensions: Record<string, unknown> = {};
    for (const [name, raw] of Object.entries(resolvedPluginData)) {
      const normalized = this.pluginDataValidator.normalizeProviderResult(name, raw);
      if (normalized !== undefined) {
        validatedExtensions[name] = normalized;
      }
    }

    const response: PublicBootstrapResponseDto = {
      version: this.getVersion(),
      tags: tags.status === 'fulfilled' ? tags.value : [],
      totalArticles: overall.status === 'fulfilled' ? overall.value.publishedArticles : 0,
      totalWordCount: totalWordCount.status === 'fulfilled' ? totalWordCount.value : 0,
      siteInfo: siteInfo.status === 'fulfilled' ? siteInfo.value : this.getDefaultSiteInfo(),
      navigation: navigation.status === 'fulfilled' ? navigation.value : [],
      friendLinks: friendLinks.status === 'fulfilled' ? friendLinks.value : [],
      categories: categories.status === 'fulfilled' ? categories.value : [],
      ...(walineSettings.status === 'fulfilled' &&
        walineSettings.value && { walineConfig: walineSettings.value }),
      extensions: validatedExtensions,
    };

    // 允许插件过滤/转换响应
    let filtered: PublicBootstrapResponseDto;
    try {
      filtered = await this.hookService.applyFilters('bootstrap|transformResponse', response, {
        action: 'public',
      });
    } catch {
      filtered = response;
    }

    // 插件钩子：生成后
    try {
      await this.hookService.doAction('bootstrap|afterGenerate', filtered, { action: 'public' });
    } catch {
      // ignore plugin errors
    }

    return filtered;
  }

  private async getAllTags(): Promise<string[]> {
    const tagResponse = await this.tagService.findAll();
    return tagResponse.items.map((tag) => tag.name);
  }

  private async getAllCategories(): Promise<string[]> {
    const categoryResponse = await this.categoryService.findAll();
    return categoryResponse.items.map((category) => category.name);
  }

  private getVersion(): string {
    return this.configService.get<string>('APP_VERSION') ?? 'dev';
  }

  private async getWalineConfig(): Promise<{ serverURL?: string } | undefined> {
    try {
      const cfg = await this.commentService.getResolvedWalineConfig();
      return cfg;
    } catch {
      return undefined;
    }
  }

  private getDefaultSiteInfo(): {
    title: string;
    description: string;
    author: string;
    keywords: string[];
  } {
    return {
      title: 'My Blog',
      description: 'A blog powered by VanBlog',
      author: 'Admin',
      keywords: [],
    };
  }
}
