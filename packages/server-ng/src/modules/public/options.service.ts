import { Injectable } from '@nestjs/common';

import { ArticleService } from '../article/article.service';
import { CategoryService } from '../category/category.service';
import { CommentService } from '../comment/comment.service';
import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { TagService } from '../tag/tag.service';

import {
  INCLUDE_OPTIONS,
  type OptionsQueryDto,
  type OptionsResponseDto,
  type IncludeOption,
} from './dto/options.dto';

@Injectable()
export class OptionsService {
  constructor(
    private readonly articleService: ArticleService,
    private readonly categoryService: CategoryService,
    private readonly tagService: TagService,
    private readonly settingCoreService: SettingCoreService,
    private readonly commentService: CommentService,
    private readonly hookService: HookService,
  ) {}

  async getOptions(query: OptionsQueryDto): Promise<OptionsResponseDto> {
    const { include } = query;
    const response: OptionsResponseDto = {};

    // 处理 include 字段，按需获取数据（容错 + 强类型）
    const includeArray: string[] = Array.isArray(include)
      ? (include as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];

    const includeMap: Record<IncludeOption, boolean> = {} as Record<IncludeOption, boolean>;
    for (const field of includeArray) {
      if ((INCLUDE_OPTIONS as readonly string[]).includes(field)) {
        includeMap[field as IncludeOption] = true;
      }
    }

    // 构建并行执行任务
    const tasks: Array<Promise<void>> = [];

    if (includeMap.articles) {
      tasks.push(
        this.articleService
          .findAll({
            page: 1,
            pageSize: 20,
            includeHidden: false,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          })
          .then((result) => {
            response.articles = result;
          }),
      );
    }

    if (includeMap.categories) {
      tasks.push(
        this.categoryService.findAll().then((result) => {
          response.categories = result.items.map((category) => ({
            name: category.name,
            slug: category.slug,
            description: category.description,
          }));
        }),
      );
    }

    if (includeMap.tags) {
      tasks.push(
        this.tagService.findAll().then((result) => {
          response.tags = result.items.map((tag) => ({
            name: tag.name,
            slug: tag.slug,
          }));
        }),
      );
    }

    if (includeMap.siteMeta) {
      tasks.push(
        this.settingCoreService.getSiteInfo().then((siteInfo) => {
          response.siteMeta = {
            title: siteInfo.title,
            description: siteInfo.description,
            author: siteInfo.author,
            keywords: siteInfo.keywords,
          };
        }),
      );
    }

    if (includeMap.navigation) {
      tasks.push(
        this.settingCoreService.getNavigation().then((navigation) => {
          response.navigation = navigation;
        }),
      );
    }

    if (includeMap.friendLinks) {
      tasks.push(
        this.settingCoreService.getFriendLinks().then((friendLinks) => {
          response.friendLinks = friendLinks;
        }),
      );
    }

    if (includeMap.socialLinks) {
      tasks.push(
        Promise.resolve().then(() => {
          // socialLinks 在 bootstrap 中总是返回空数组
          response.socialLinks = [];
        }),
      );
    }

    if (includeMap.rewards) {
      tasks.push(
        this.hookService
          .applyFilters('bootstrap_rewards', [])
          .then((rewards) => {
            response.rewards = rewards;
          })
          .catch(() => {
            response.rewards = [];
          }),
      );
    }

    if (includeMap.walineConfig) {
      tasks.push(
        this.getWalineConfig().then((walineConfig) => {
          if (walineConfig) {
            response.walineConfig = walineConfig;
          }
        }),
      );
    }

    // 并行执行所有任务
    await Promise.allSettled(tasks);

    return response;
  }

  private async getWalineConfig(): Promise<{ serverURL?: string } | undefined> {
    try {
      const walineSettings = await this.commentService.getWalineSetting();
      return {
        serverURL: walineSettings.serverURL,
      };
    } catch {
      return undefined;
    }
  }
}
