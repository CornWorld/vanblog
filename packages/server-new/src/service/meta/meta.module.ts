import { Module } from '@nestjs/common';
import { InitController } from './controller/init.controller';
import { MetaController } from './controller/meta.controller';
import { SettingController } from './controller/setting.controller';
import { InitProvider } from './provider/init.provider';
import { MetaProvider } from './provider/meta.provider';
import { SettingProvider } from './provider/setting.provider';
import { AboutMetaController } from './controller/about.meta.controller';
import { LinkMetaController } from './controller/link.meta.controller';
import { MenuMetaController } from './controller/menu.meta.controller';
import { RewardMetaController } from './controller/reward.meta.controller';
import { SiteMetaController } from './controller/site.meta.controller';
import { SocialMetaController } from './controller/social.meta.controller';
import { SiteMapProvider } from './provider/sitemap.provider';
import { WebsiteProvider } from './provider/website.provider';

import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';
import { AnalysisModule } from 'src/service/analysis/analysis.module';
import { AssetManageModule } from 'src/service/assetManage/assetManage.module';
import { AuthModule } from 'src/service/auth/auth.module';
import { ContentManagementModule } from 'src/service/contentManagement/contentManagement.module';
import { IsrModule } from 'src/service/isr/isr.module';
import { WalineModule } from 'src/service/waline/waline.module';
@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    AuthModule,
    WalineModule,
    AnalysisModule,
    ContentManagementModule,
    IsrModule,
    AssetManageModule,
  ],
  controllers: [
    InitController,
    MetaController,
    SettingController,
    AboutMetaController,
    LinkMetaController,
    MenuMetaController,
    RewardMetaController,
    SiteMetaController,
    SocialMetaController,
  ],
  providers: [InitProvider, MetaProvider, SettingProvider, SiteMapProvider, WebsiteProvider],
})
export class MetaModule {}
