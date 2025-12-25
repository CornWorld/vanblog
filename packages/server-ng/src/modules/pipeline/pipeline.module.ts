import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { PermissionModule } from '../permission/permission.module';
import { PluginModule } from '../plugin/plugin.module';

import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [
    SharedModule,
    PluginModule,
    PermissionModule.forFeature([
      'pipeline:create',
      'pipeline:read',
      'pipeline:update',
      'pipeline:delete',
      'pipeline:execute',
    ]),
  ],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
