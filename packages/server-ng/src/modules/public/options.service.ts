import { Injectable } from '@nestjs/common';

import { ArticleService } from '../article/article.service';
import { CategoryService } from '../category/category.service';
import { CommentService } from '../comment/comment.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { TagService } from '../tag/tag.service';

import {
  INCLUDE_OPTIONS,
  type OptionsQueryDto,
  type OptionsResponseDto,
  type IncludeOption,
} from './dto/options.dto';

import type { CategoryWithCountDto } from '../category/dto/category.dto';
import type { TagWithCountDto } from '../tag/dto/tag.dto';

@Injectable()
export class OptionsService {
  constructor(
    private readonly articleService: ArticleService,
    private readonly categoryService: CategoryService,
    private readonly tagService: TagService,
    private readonly settingCoreService: SettingCoreService,
    private readonly commentService: CommentService,
  ) {}

  async getOptions(query: OptionsQueryDto): Promise<OptionsResponseDto> {
    const { include } = query;
    const response: OptionsResponseDto = {} as OptionsResponseDto;

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
          response.categories = (result.items as CategoryWithCountDto[]).map((category) => ({
            name: category.name,
            slug: category.slug ?? '',
            description: category.description ?? undefined,
          }));
        }),
      );
    }

    if (includeMap.tags) {
      tasks.push(
        this.tagService.findAll().then((result) => {
          response.tags = (result.items as TagWithCountDto[]).map((tag) => ({
            name: tag.name,
            slug: tag.slug ?? '',
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

    // socialLinks and rewards have been removed from the system
    // Plugin data should be accessed through extensions field in bootstrap response

    if (includeMap.walineConfig) {
      tasks.push(
        this.commentService
          .getResolvedWalineConfig()
          .then((walineConfig) => {
            const url = walineConfig.serverURL ?? '';
            if (url !== '') {
              response.walineConfig = { serverURL: url };
            }
          })
          .catch(() => {}),
      );
    }

    // 并行执行所有任务
    await Promise.allSettled(tasks);

    return response;
  }
}
