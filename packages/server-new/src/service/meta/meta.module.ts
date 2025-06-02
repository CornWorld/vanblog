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

import { InfraModule } from 'src/infra/infra.module';
import { WalineModule } from '../waline/waline.module';
import { AuthModule } from '../auth/auth.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { ContentManagementModule } from '../contentManagement/contentManagement.module';
import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';
import { IsrModule } from '../isr/isr.module';
import { AssetManageModule } from '../assetManage/assetManage.module';

@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    AuthModule,
    InfraModule,
    WalineModule,
    AnalysisModule,
    ContentManagementModule,
    IsrModule,
    AssetManageModule
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
  providers: [
    InitProvider,
    MetaProvider,
    SettingProvider,
    SiteMapProvider,
    WebsiteProvider
  ]
})
export class MetaModule { }
