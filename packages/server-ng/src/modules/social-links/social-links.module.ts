import { Module, OnModuleInit } from '@nestjs/common';

import { SettingModule } from '../setting/setting.module';

import { SocialLinksController } from './social-links.controller';
import { SocialLinksService } from './social-links.service';

@Module({
  imports: [SettingModule],
  controllers: [SocialLinksController],
  providers: [SocialLinksService],
  exports: [SocialLinksService],
})
export class SocialLinksModule implements OnModuleInit {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  onModuleInit(): void {
    this.socialLinksService.registerConfig();
  }
}
