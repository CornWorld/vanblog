import { Module } from '@nestjs/common';

import { PermissionModule } from '../permission/permission.module';
import { SettingModule } from '../setting/setting.module';

import { CaddyController } from './caddy.controller';
import { CaddyService } from './caddy.service';

@Module({
  imports: [
    SettingModule,
    PermissionModule.forFeature([
      'caddy:read',
      'caddy:update',
      'caddy:manage',
      'caddy:config',
      'caddy:logs',
    ]),
  ],
  controllers: [CaddyController],
  providers: [CaddyService],
  exports: [CaddyService],
})
export class CaddyModule {}
