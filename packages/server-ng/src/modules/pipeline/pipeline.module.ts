import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import { PipelineController } from './pipeline.controller';
import { PipelineService } from './services/pipeline.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
