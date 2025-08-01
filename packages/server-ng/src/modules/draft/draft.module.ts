import { Module } from '@nestjs/common';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';
import { DraftVersionService } from './draft-version.service';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [PipelineModule],
  controllers: [DraftController],
  providers: [DraftService, DraftVersionService],
  exports: [DraftService, DraftVersionService],
})
export class DraftModule {}
