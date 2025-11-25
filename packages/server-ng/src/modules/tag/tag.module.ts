import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { PermissionModule } from '../permission/permission.module';

import { TagController } from './tag.controller';
import { TagService } from './tag.service';
import { TagTsRestController } from './tag.ts-rest.controller';

@Module({
  imports: [
    SharedModule,
    PermissionModule.forFeature(['tag:create', 'tag:read', 'tag:update', 'tag:delete']),
  ],
  controllers: [TagController, TagTsRestController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
