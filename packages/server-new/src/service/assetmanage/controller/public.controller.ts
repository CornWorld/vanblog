import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SortOrder } from 'src/types/sort';
import { ArticleProvider } from '../../contentManagement/provider/article.provider';
import { CategoryProvider } from '../../contentManagement/provider/category.provider';
import { MetaProvider } from '../../meta/provider/meta.provider';
import { SettingProvider } from '../../meta/provider/setting.provider';
import { TagProvider } from '../../contentManagement/provider/tag.provider';
import { VisitProvider } from '../../analysis/provider/visit.provider';
import { version } from '../../../common/config/loadConfig';
import { CustomPageProvider } from '../../contentManagement/provider/customPage.provider';
import { encode } from 'js-base64';
import { Result } from 'src/common/result/Result';

// Import defaultMenu from website package
const defaultMenu = [
  {
    id: 0,
    name: '首页',
    value: '/',
    level: 0,
  },
  {
    id: 1,
    name: '标签',
    value: '/tag',
    level: 0,
  },
  {
    id: 2,
    name: '分类',
    value: '/category',
    level: 0,
  },
  {
    id: 3,
    name: '时间线',
    value: '/timeline',
    level: 0,
  },
  {
    id: 4,
    name: '友链',
    value: '/link',
    level: 0,
  },
  {
    id: 5,
    name: '关于',
    value: '/about',
    level: 0,
  },
];

@ApiTags('public')
@Controller('/api/public/')
export class PublicController {
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly categoryProvider: CategoryProvider,
    private readonly tagProvider: TagProvider,
    private readonly metaProvider: MetaProvider,
    private readonly visitProvider: VisitProvider,
    private readonly settingProvider: SettingProvider,
    private readonly customPageProvider: CustomPageProvider,
  ) { }
  @Get('/customPage/all')
  async getAll() {
    return Result.ok(await this.customPageProvider.getAll()).toObject();
  }
  @Get('/customPage')
  async getOneByPath(@Query('path') path: string) {
    const data = await this.customPageProvider.getCustomPageByPath(path);

    return Result.ok({
      ...data,
      html: data?.html ? encode(data?.html) : '',
    },).toObject()
  }
  @Get('/article/:id')
  async getArticleByIdOrPathname(@Param('id') id: string) {
    const data = await this.articleProvider.getByIdOrPathnameWithPreNext(id, 'public');
    return Result.ok(data).toObject();
  }
  @Post('/article/:id')
  async getArticleByIdOrPathnameWithPassword(
    @Param('id') id: number | string,
    @Body() body: { password: string },
  ) {
    const data = await this.articleProvider.getByIdWithPassword(id, body?.password);
    return Result.ok(data).toObject();
  }

  @Get('/search')
  async searchArticle(@Query('value') search: string) {
    const data = await this.articleProvider.searchByString(search, false);

    return Result.ok({
      total: data.length,
      data: this.articleProvider.toSearchResult(data),
    }).toObject();
  }
  @Post('/viewer')
  async addViewer(
    @Query('isNew') isNew: boolean,
    @Query('isNewByPath') isNewByPath: boolean,
    @Req() req: Request,
  ) {
    const refer = req.headers.referer;
    const url = new URL(refer);
    if (!url.pathname || url.pathname == '') {
      console.log('没找到 refer:', req.headers);
    }
    const data = await this.metaProvider.addViewer(
      isNew,
      decodeURIComponent(url.pathname),
      isNewByPath,
    );
    return Result.ok(data).toObject();
  }

  @Get('/viewer')
  async getViewer() {
    const data = await this.metaProvider.getViewer();
    return Result.ok(data).toObject();
  }
  @Get('/article/viewer/:id')
  async getViewerByArticleIdOrPathname(@Param('id') id: number | string) {
    const data = await this.visitProvider.getByArticleId(id);
    return Result.ok(data).toObject();
  }

  @Get('/tag/:name')
  async getArticlesByTagName(@Param('name') name: string) {
    const data = await this.tagProvider.getArticlesByTag(name, false);
    return Result.ok(this.articleProvider.toPublic(data)).toObject();
  }
  @Get('article')
  async getByOption(
    @Query('page') page: number,
    @Query('pageSize') pageSize = 5,
    @Query('toListView') toListView = false,
    @Query('regMatch') regMatch = false,
    @Query('withWordCount') withWordCount = false,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('sortTop') sortTop?: SortOrder,
  ) {
    const option = {
      page: parseInt(String(page)),
      pageSize: parseInt(String(pageSize)),
      category,
      tags,
      toListView,
      regMatch,
      sortTop,
      sortCreatedAt,
      withWordCount,
    };
    // 三个 sort 是完全排他的。
    const data = await this.articleProvider.getByOption(option, true);
    return Result.ok(data).toObject();
  }
  @Get('timeline')
  async getTimeLineInfo() {
    const data = await this.articleProvider.getTimeLineInfo();
    return Result.ok(data).toObject();
  }
  @Get('category')
  async getArticlesByCategory() {
    const data = await this.categoryProvider.getCategoriesWithArticle(false);
    return Result.ok(data).toObject();
  }
  @Get('tag')
  async getArticlesByTag() {
    const data = await this.tagProvider.getTagsWithArticle(false);
    return Result.ok(data).toObject();
  }

  @Get('/meta')
  async getBuildMeta() {
    try {
      const tags = (await this.tagProvider.getAllTags(false)) || [];
      const rawMeta = await this.metaProvider.getAll();
      console.log('Raw meta:', rawMeta);

      // Ensure we have valid defaults
      const defaultMeta = {
        links: [],
        socials: [],
        rewards: [],
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
      };

      // Get the document data
      let metaDoc = defaultMeta;

      // If we have valid meta data, merge it with defaults
      if (rawMeta) {
        if (typeof rawMeta === 'object') {
          if ('_doc' in rawMeta) {
            // Handle Mongoose document
            metaDoc = Object.assign({}, defaultMeta, rawMeta._doc);
          } else {
            // Regular object
            metaDoc = Object.assign({}, defaultMeta, rawMeta);
          }
        }
      }

      console.log('Meta doc:', metaDoc);
      const categories = (await this.categoryProvider.getAllCategories(false)) || [];
      const { data: menus } = (await this.settingProvider.getMenuSetting()) || {
        data: defaultMenu,
      };
      const totalArticles = (await this.articleProvider.getTotalNum(false)) || 0;
      const totalWordCount = (await this.metaProvider.getTotalWords()) || 0;
      const LayoutSetting = await this.settingProvider.getLayoutSetting();
      const LayoutRes = this.settingProvider.encodeLayoutSetting(LayoutSetting);

      const data = {
        version: version || 'dev',
        tags,
        meta: {
          ...metaDoc,
          categories,
        },
        menus: menus || defaultMenu,
        totalArticles,
        totalWordCount,
        ...(LayoutSetting ? { layout: LayoutRes } : {}),
      };

      console.log('Final data:', data);
      return Result.ok(data).toObject();
    } catch (error) {
      console.error('Error in getBuildMeta:', error);
      // Return default data structure on error
      const data = {
        version: version || 'dev',
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
        menus: defaultMenu,
        totalArticles: 0,
        totalWordCount: 0,
      }
      return Result.ok(data).toObject();
    }
  }
}
