import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { PermissionModule } from '../permission/permission.module';

import { TagController } from './tag.controller';
import { TagService } from './tag.service';

@Module({
  imports: [
    SharedModule,
    PermissionModule.forFeature(['tag:create', 'tag:read', 'tag:update', 'tag:delete']),
  ],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
