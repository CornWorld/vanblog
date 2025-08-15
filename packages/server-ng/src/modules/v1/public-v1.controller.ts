import {
  Controller,
  Get,
  Param,
  NotFoundException,
  Query,
  Post,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

import { AnalyticsType } from '../analytics/entities/analytics.entity';
import { AnalyticsService } from '../analytics/services/analytics.service';
import { ArticleService } from '../article/article.service';
import { CategoryService } from '../category/category.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { TagService } from '../tag/tag.service';

import type { Request } from 'express';

// Default menu structure for v1 compatibility
const DEFAULT_MENU = [
  { name: 'Home', path: '/' },
  { name: 'Archive', path: '/archive' },
  { name: 'About', path: '/about' },
];

@ApiTags('publicv1')
@Controller({ path: 'public', version: '1' })
export class PublicV1Controller {
  constructor(
    private readonly articleService: ArticleService,
    private readonly categoryService: CategoryService,
    private readonly tagService: TagService,
    private readonly analyticsService: AnalyticsService,
    private readonly settingCoreService: SettingCoreService,
  ) {}

  @Get('getAllCustomPages')
  @ApiOperation({ summary: 'Get all custom pages' })
  @ApiResponse({ status: 200, description: 'Return all custom pages' })
  getAllCustomPages(): { statusCode: number; data: unknown[] } {
    // TODO: Implement custom pages functionality
    return {
      statusCode: 200,
      data: [],
    };
  }

  @Get('getCustomPageByPath/:path')
  @ApiOperation({ summary: 'Get custom page by path' })
  @ApiParam({ name: 'path', description: 'Page path' })
  @ApiResponse({ status: 200, description: 'Return custom page' })
  getCustomPageByPath(@Param('path') _path: string): { statusCode: number; data: unknown } {
    // TODO: Implement custom page by path functionality
    return {
      statusCode: 200,
      data: null,
    };
  }

  @Get('getArticleByIdOrPathname/:idOrPathname')
  @ApiOperation({ summary: 'Get article by ID or pathname' })
  @ApiParam({ name: 'idOrPathname', description: 'Article ID or pathname' })
  @ApiResponse({ status: 200, description: 'Return article' })
  async getArticleByIdOrPathname(@Param('idOrPathname') idOrPathname: string): Promise<unknown> {
    const id = parseInt(idOrPathname, 10);
    if (!isNaN(id)) {
      try {
        const article = await this.articleService.findOne(id);
        if (article.hidden) {
          throw new NotFoundException('Article not found');
        }
        return { statusCode: 200, data: article };
      } catch {
        throw new NotFoundException('Article not found');
      }
    }

    try {
      const article = await this.articleService.findOneByPathname(idOrPathname);
      if (article.hidden) {
        throw new NotFoundException('Article not found');
      }
      return { statusCode: 200, data: article };
    } catch {
      throw new NotFoundException('Article not found');
    }
  }

  @Get('getArticleWithPassword/:idOrPathname')
  @ApiOperation({ summary: 'Get article with password verification' })
  @ApiParam({ name: 'idOrPathname', description: 'Article ID or pathname' })
  @ApiQuery({ name: 'password', required: false, description: 'Article password' })
  @ApiResponse({ status: 200, description: 'Return article' })
  async getArticleWithPassword(
    @Param('idOrPathname') idOrPathname: string,
    @Query('password') _password?: string,
  ): Promise<unknown> {
    try {
      const article = await this.getArticleByIdOrPathname(idOrPathname);
      if (article === null || article === undefined) {
        return null;
      }

      // TODO: Implement password verification logic
      // For now, return the article if password is provided or not needed
      return article;
    } catch {
      return null;
    }
  }

  @Get('searchArticle')
  @ApiOperation({ summary: 'Search articles' })
  @ApiQuery({ name: 'keyword', required: false, description: 'Search keyword' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size' })
  @ApiResponse({ status: 200, description: 'Return search results' })
  async searchArticle(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<unknown> {
    try {
      const result = await this.articleService.search({
        keyword: keyword ?? '',
        page: parseInt(page ?? '1', 10),
        pageSize: parseInt(pageSize ?? '10', 10),
      });
      return {
        statusCode: 200,
        data: {
          articles: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        },
      };
    } catch {
      return {
        statusCode: 200,
        data: { articles: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
      };
    }
  }

  @Post('addViewer')
  @ApiOperation({ summary: 'Add page viewer' })
  @ApiResponse({ status: 200, description: 'Viewer added successfully' })
  async addViewer(@Body() body: unknown, @Req() req: Request): Promise<unknown> {
    try {
      const referer = req.get('referer') ?? undefined;
      const userAgent = req.get('user-agent') ?? '';
      const ip = req.ip ?? '';

      function hasValidPath(input: unknown): input is { path: string } {
        if (typeof input !== 'object' || input === null) return false;
        if (!('path' in input)) return false;
        const value = (input as { path?: unknown }).path;
        return typeof value === 'string';
      }

      const path = hasValidPath(body) ? body.path : '/';

      await this.analyticsService.recordAnalytics({
        type: AnalyticsType.PAGEVIEW,
        path,
        referrer: referer,
        userAgent,
        ip,
        data: null,
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  @Get('getViewer')
  @ApiOperation({ summary: 'Get viewer statistics' })
  @ApiResponse({ status: 200, description: 'Return viewer statistics' })
  async getViewer(): Promise<unknown> {
    try {
      const overview = await this.analyticsService.getOverview();
      return {
        statusCode: 200,
        data: overview,
      };
    } catch {
      return {
        statusCode: 200,
        data: { totalPageviews: 0, totalVisitors: 0 },
      };
    }
  }

  @Get('getViewerByArticleIdOrPathname/:idOrPathname')
  @ApiOperation({ summary: 'Get viewer statistics by article ID or pathname' })
  @ApiParam({ name: 'idOrPathname', description: 'Article ID or pathname' })
  @ApiResponse({ status: 200, description: 'Return viewer statistics' })
  getViewerByArticleIdOrPathname(@Param('idOrPathname') _idOrPathname: string): unknown {
    // TODO: Implement articlespecific viewer statistics
    return { views: 0, uniqueVisitors: 0 };
  }

  @Get('getArticlesByTagName/:tagName')
  @ApiOperation({ summary: 'Get articles by tag name' })
  @ApiParam({ name: 'tagName', description: 'Tag name' })
  @ApiResponse({ status: 200, description: 'Return articles' })
  async getArticlesByTagName(@Param('tagName') tagName: string): Promise<unknown> {
    try {
      const result = await this.articleService.search({
        keyword: tagName,
        tags: [tagName],
        page: 1,
        pageSize: 100,
        includeHidden: false,
      });
      return {
        statusCode: 200,
        data: {
          articles: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        },
      };
    } catch {
      return {
        statusCode: 200,
        data: { articles: [], total: 0, page: 1, pageSize: 100, totalPages: 0 },
      };
    }
  }

  @Get('getByOption')
  @ApiOperation({ summary: 'Get data by option' })
  @ApiQuery({ name: 'option', required: true, description: 'Option type' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size' })
  @ApiResponse({ status: 200, description: 'Return data by option' })
  async getByOption(
    @Query('option') option: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<unknown> {
    switch (option) {
      case 'articles': {
        const result = await this.articleService.findAll({
          page: parseInt(page ?? '1', 10),
          pageSize: parseInt(pageSize ?? '10', 10),
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
        return {
          statusCode: 200,
          data: {
            articles: result.items,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: result.totalPages,
          },
        };
      }
      case 'categories': {
        const categories = await this.categoryService.findAll();
        return {
          statusCode: 200,
          data: categories,
        };
      }
      case 'tags': {
        const tags = await this.tagService.findAll();
        return {
          statusCode: 200,
          data: tags,
        };
      }
      case 'siteInfo':
        return await this.settingCoreService.getSiteInfo();
      case 'layout':
        return await this.settingCoreService.getLayoutSettings();
      case 'theme':
        return await this.settingCoreService.getThemeSettings();
      case 'navigation':
        return await this.settingCoreService.getNavigation();
      default:
        throw new BadRequestException('Invalid option');
    }
  }

  @Get('getTimeLineInfo')
  @ApiOperation({ summary: 'Get timeline information' })
  @ApiResponse({ status: 200, description: 'Return timeline information' })
  getTimeLineInfo(): unknown {
    return {
      statusCode: 200,
      data: {
        timeline: [],
      },
    };
  }

  @Get('getArticlesByCategory/:category')
  @ApiOperation({ summary: 'Get articles by category' })
  @ApiParam({ name: 'category', description: 'Category name' })
  @ApiResponse({ status: 200, description: 'Return articles' })
  async getArticlesByCategory(
    @Param('category') category: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<unknown> {
    try {
      const result = await this.articleService.findByCategory(category, {
        page: parseInt(page ?? '1', 10),
        pageSize: parseInt(pageSize ?? '10', 10),
        includeHidden: false,
      });
      return {
        statusCode: 200,
        data: {
          articles: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        },
      };
    } catch {
      return {
        statusCode: 200,
        data: { articles: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
      };
    }
  }

  @Get('getArticlesByTag/:tag')
  @ApiOperation({ summary: 'Get articles by tag' })
  @ApiParam({ name: 'tag', description: 'Tag name' })
  @ApiResponse({ status: 200, description: 'Return articles' })
  async getArticlesByTag(@Param('tag') tag: string): Promise<unknown> {
    const isNumericId = /^\d+$/.test(tag);

    let tagName = tag;
    if (isNumericId) {
      try {
        // First check if the tag ID exists and resolve to tag name
        const tagEntity = await this.tagService.findOne(Number(tag));
        tagName = tagEntity.name;
      } catch {
        // Tag not found, return 404
        throw new NotFoundException(`Tag with ID ${tag} not found`);
      }
    }

    try {
      const result = await this.articleService.search({
        keyword: tagName,
        tags: [tagName],
        page: 1,
        pageSize: 100,
        includeHidden: false,
      });
      return {
        statusCode: 200,
        data: {
          articles: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        },
      };
    } catch {
      return {
        statusCode: 200,
        data: { articles: [], total: 0, page: 1, pageSize: 100, totalPages: 0 },
      };
    }
  }

  @Get('getMeta')
  @ApiOperation({ summary: 'Get site metadata (v1 compatible alias)' })
  @ApiResponse({ status: 200, description: 'Return site metadata' })
  async getMetaAlias(): Promise<unknown> {
    return this.getBuildMeta();
  }

  @Get('getBuildMeta')
  @ApiOperation({ summary: 'Get build metadata' })
  @ApiResponse({ status: 200, description: 'Return build metadata' })
  async getBuildMeta(): Promise<unknown> {
    try {
      const tags = await this.tagService.findAll();
      const categories = await this.categoryService.findAll();
      const siteInfo = await this.settingCoreService.getSiteInfo();
      const navigation = await this.settingCoreService.getNavigation();
      const articlesResult = await this.articleService.findAll({
        page: 1,
        pageSize: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      // Default meta structure for v1 compatibility
      const defaultMeta = {
        links: [],
        socials: [],
        rewards: [],
        about: {
          updatedAt: new Date().toISOString(),
          content: '',
        },
        siteInfo: {
          author: siteInfo.author,
          authorDesc: siteInfo.description,
          authorLogo: '',
          siteLogo: '',
          favicon: '',
          siteName: siteInfo.title,
          siteDesc: siteInfo.description,
          baseUrl: '',
          since: '',
          copyrightAggreement: '',
          showSubMenu: 'false',
          showAdminButton: 'false',
          headerLeftContent: 'siteName',
          showDonateInfo: 'false',
          showFriends: 'false',
          enableComment: 'false',
          defaultTheme: 'auto',
          enableCustomizing: 'false',
          showDonateButton: 'false',
          showCopyRight: 'false',
          showRSS: 'false',
          openArticleLinksInNewWindow: 'false',
          showExpirationReminder: 'false',
          showEditButton: 'false',
        },
        categories,
      };

      const data = {
        version: 'v2compat',
        tags,
        meta: defaultMeta,
        menus: navigation.length > 0 ? navigation : DEFAULT_MENU,
        totalArticles: articlesResult.total,
        totalWordCount: 0, // TODO: Implement word count calculation
      };

      return {
        statusCode: 200,
        data,
      };
    } catch {
      return {
        statusCode: 500,
        data: {
          version: 'v2compat',
          tags: [],
          meta: {
            links: [],
            socials: [],
            rewards: [],
            categories: [],
            about: {
              updatedAt: new Date().toISOString(),
              content: '',
            },
            siteInfo: {
              author: '',
              authorDesc: '',
              authorLogo: '',
              siteLogo: '',
              favicon: '',
              siteName: '',
              siteDesc: '',
              baseUrl: '',
              since: '',
              copyrightAggreement: '',
              showSubMenu: 'false',
              showAdminButton: 'false',
              headerLeftContent: 'siteName',
              showDonateInfo: 'false',
              showFriends: 'false',
              enableComment: 'false',
              defaultTheme: 'auto',
              enableCustomizing: 'false',
              showDonateButton: 'false',
              showCopyRight: 'false',
              showRSS: 'false',
              openArticleLinksInNewWindow: 'false',
              showExpirationReminder: 'false',
              showEditButton: 'false',
            },
          },
          menus: DEFAULT_MENU,
          totalArticles: 0,
          totalWordCount: 0,
        },
      };
    }
  }
}
