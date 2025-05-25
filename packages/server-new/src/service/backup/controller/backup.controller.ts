import {
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ArticleProvider } from '../../contentManagement/provider/article.provider';
import { AdminGuard } from '../../auth/guard/auth.guard';
import { CategoryProvider } from '../../contentManagement/provider/category.provider';
import { DraftProvider } from '../../contentManagement/provider/draft.provider';
import { MetaProvider } from '../../meta/provider/meta.provider';
import { TagProvider } from '../../contentManagement/provider/tag.provider';
import { UserProvider } from '../../auth/provider/user.provider';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { omit } from 'lodash-es';
import { ViewerProvider } from '../../analysis/provider/viewer.provider';
import { VisitProvider } from '../../analysis/provider/visit.provider';
import { StaticProvider } from '../../assetmanage/provider/static.provider';
import { SettingProvider } from '../../meta/provider/setting.provider';
import { config } from '../../../common/config';
import { ApiToken } from '../../../common/swagger/token';

@ApiTags('backup')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly categoryProvider: CategoryProvider,
    private readonly tagProvider: TagProvider,
    private readonly metaProvider: MetaProvider,
    private readonly draftProvider: DraftProvider,
    private readonly userProvider: UserProvider,
    private readonly viewerProvider: ViewerProvider,
    private readonly visitProvider: VisitProvider,
    private readonly settingProvider: SettingProvider,
    private readonly staticProvider: StaticProvider,
  ) { }

  @Get('export')
  async getAll(@Res() res: Response) {
    const articles = await this.articleProvider.getAll('admin', true);
    const categories = await this.categoryProvider.getAllCategories();
    const tags = await this.tagProvider.getAllTags(true);
    const meta = await this.metaProvider.getAll();
    const drafts = await this.draftProvider.getAll();
    const user = await this.userProvider.getUser();
    // 访客记录
    const viewer = await this.viewerProvider.getAll();
    const visit = await this.visitProvider.getAll();
    // 设置表
    const staticSetting = await this.settingProvider.getStaticSetting();
    const staticItems = await this.staticProvider.exportAll();
    const data = {
      articles,
      tags,
      meta,
      drafts,
      categories,
      user,
      viewer,
      visit,
      static: staticItems,
      setting: { static: staticSetting },
    };
    // 拼接一个临时文件
    const name = `temp.json`;
    fs.writeFileSync(name, JSON.stringify(data, null, 2));
    res.download(name, (err) => {
      if (!err) {
        this.logger.log('success', 'download');
        return;
      }
      this.logger.error(err.stack);
      fs.rmSync(name);
    });
  }

  @Post('/import')
  @UseInterceptors(FileInterceptor('file'))
  async importAll(@UploadedFile() file: Express.Multer.File) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const json = file.buffer.toString();
    const data = JSON.parse(json);
    const { meta, user, setting } = data;
    let { articles, drafts, viewer, visit, static: staticItems } = data;
    // 去掉 id
    articles = articles?.map((item) => omit(item, ['_id', '__v'])) || null;
    drafts = drafts?.map((item) => omit(item, ['_id', '__v'])) || null;
    viewer = viewer?.map((item) => omit(item, ['_id', '__v'])) || null;
    visit = visit?.map((item) => omit(item, ['_id', '__v'])) || null;
    if (staticItems) {
      staticItems = staticItems.map((item) => omit(item, ['_id', '__v']));
    }
    if (setting && setting.static) {
      setting.static = { ...setting.static, _id: undefined, __v: undefined };
    }
    delete user._id;
    delete user.__v;
    delete meta._id;

    await this.articleProvider.importArticles(articles);
    await this.draftProvider.importDrafts(drafts);
    await this.userProvider.updateUser(user);
    await this.metaProvider.update(meta);
    await this.settingProvider.importSetting(setting);
    await this.staticProvider.importItems(staticItems);
    if (visit) {
      await this.visitProvider.import(visit);
    }
    if (viewer) {
      await this.viewerProvider.import(viewer);
    }
    return {
      statusCode: 200,
      data: '导入成功！',
    };
  }
}
