import { Module } from '@nestjs/common';

import { PipelineModule } from '../pipeline/pipeline.module';
import { PluginModule } from '../plugin/plugin.module';

import { DraftVersionService } from './draft-version.service';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';

@Module({
  imports: [PipelineModule, PluginModule],
  controllers: [DraftController],
  providers: [DraftService, DraftVersionService],
  exports: [DraftService, DraftVersionService],
})
export class DraftModule {}
