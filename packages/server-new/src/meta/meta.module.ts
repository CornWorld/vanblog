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

@Module({
  imports: [],
  controllers: [
    InitController,
    MetaController,
    SettingController,
    AboutMetaController,
    LinkMetaController,
    MenuMetaController,
    RewardMetaController,
    SiteMetaController,
    SocialMetaController
  ],
  providers: [
    InitProvider,
    MetaProvider,
    SettingProvider
  ],
})
export class MetaModule { }
