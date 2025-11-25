import { Module } from '@nestjs/common';

import { PermissionModule } from '../permission/permission.module';
import { PluginModule } from '../plugin/plugin.module';

import { DraftVersionService } from './draft-version.service';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';
import { DraftTsRestController } from './draft.ts-rest.controller';

@Module({
  imports: [
    PluginModule,
    PermissionModule.forFeature([
      'draft:create',
      'draft:read',
      'draft:update',
      'draft:delete',
      'draft:publish',
    ]),
  ],
  controllers: [DraftController, DraftTsRestController],
  providers: [DraftService, DraftVersionService],
  exports: [DraftService],
})
export class DraftModule {}
