import { Module } from '@nestjs/common';

import { PermissionModule } from '../permission/permission.module';
import { PluginModule } from '../plugin/plugin.module';

import { SocialLinksController } from './social-links.controller';

@Module({
  imports: [PluginModule, PermissionModule.forFeature(['setting:read', 'setting:update'])],
  controllers: [SocialLinksController],
})
export class SocialLinksModule {}
