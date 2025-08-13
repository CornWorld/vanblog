import { Controller, Get, Post, Query, Param, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';

import { AnalyticsType } from '../analytics/entities/analytics.entity';
import { AnalyticsService } from '../analytics/services/analytics.service';
import { ArticleService } from '../article/article.service';
import { CategoryService } from '../category/category.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { TagService } from '../tag/tag.service';

// Default menu structure for v1 compatibility
const DEFAULT_MENU = [
  { name: 'Home', path: '/' },
  { name: 'Archive', path: '/archive' },
  { name: 'About', path: '/about' },
];

@ApiTags('public-v1')
@Controller({ path: 'api/public', version: '1' })
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
    try {
      // Try to find by ID first (if it's a number)
      const id = parseInt(idOrPathname, 10);
      if (!isNaN(id)) {
        try {
          const article = await this.articleService.findOne(id);
          return article;
        } catch {
          // Article not found by ID, continue to search by pathname
        }
      }

      // Try to search by pathname
      const searchResult = await this.articleService.search({
        keyword: idOrPathname,
        page: 1,
        pageSize: 1,
      });

      if (searchResult.items.length > 0) {
        return searchResult.items[0];
      }

      return null;
    } catch {
      return null;
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
      return result;
    } catch {
      return { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
    }
  }

  @Post('addViewer')
  @ApiOperation({ summary: 'Add page viewer' })
  @ApiResponse({ status: 200, description: 'Viewer added successfully' })
  async addViewer(@Body() body: unknown, @Req() req: Request): Promise<unknown> {
    try {
      const { referer } = req.headers;
      const userAgent = req.headers['user-agent'] ?? '';
      const ip = req.ip ?? '';

      await this.analyticsService.recordAnalytics({
        type: AnalyticsType.PAGEVIEW,
        path: typeof body === 'object' && body && 'path' in body ? String(body.path) : '/',
        referrer: typeof referer === 'string' ? referer : undefined,
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
      return overview;
    } catch {
      return { totalPageviews: 0, totalVisitors: 0 };
    }
  }

  @Get('getViewerByArticleIdOrPathname/:idOrPathname')
  @ApiOperation({ summary: 'Get viewer statistics by article ID or pathname' })
  @ApiParam({ name: 'idOrPathname', description: 'Article ID or pathname' })
  @ApiResponse({ status: 200, description: 'Return viewer statistics' })
  getViewerByArticleIdOrPathname(@Param('idOrPathname') _idOrPathname: string): unknown {
    // TODO: Implement article-specific viewer statistics
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
        page: 1,
        pageSize: 100,
      });
      return result.items;
    } catch {
      return [];
    }
  }

  @Get('getByOption')
  @ApiOperation({ summary: 'Get data by option' })
  @ApiQuery({ name: 'option', required: true, description: 'Option type' })
  @ApiResponse({ status: 200, description: 'Return data by option' })
  async getByOption(@Query('option') option: string): Promise<unknown> {
    try {
      switch (option) {
        case 'categories':
          return await this.categoryService.findAll();
        case 'tags':
          return await this.tagService.findAll();
        case 'siteInfo':
          return await this.settingCoreService.getSiteInfo();
        case 'layout':
          return await this.settingCoreService.getLayoutSettings();
        case 'theme':
          return await this.settingCoreService.getThemeSettings();
        case 'navigation':
          return await this.settingCoreService.getNavigation();
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  @Get('getTimeLineInfo')
  @ApiOperation({ summary: 'Get timeline information' })
  @ApiResponse({ status: 200, description: 'Return timeline information' })
  getTimeLineInfo(): unknown {
    // TODO: Implement timeline functionality
    return { timeline: [] };
  }

  @Get('getArticlesByCategory/:category')
  @ApiOperation({ summary: 'Get articles by category' })
  @ApiParam({ name: 'category', description: 'Category name' })
  @ApiResponse({ status: 200, description: 'Return articles' })
  async getArticlesByCategory(@Param('category') category: string): Promise<unknown> {
    try {
      const result = await this.articleService.findByCategory(category);
      return result;
    } catch {
      return { items: [], total: 0 };
    }
  }

  @Get('getArticlesByTag/:tag')
  @ApiOperation({ summary: 'Get articles by tag' })
  @ApiParam({ name: 'tag', description: 'Tag name' })
  @ApiResponse({ status: 200, description: 'Return articles' })
  async getArticlesByTag(@Param('tag') tag: string): Promise<unknown> {
    try {
      const result = await this.articleService.search({
        keyword: tag,
        page: 1,
        pageSize: 100,
      });
      return result.items;
    } catch {
      return [];
    }
  }

  @Get('meta')
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
        version: 'v2-compat',
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
          version: 'v2-compat',
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
