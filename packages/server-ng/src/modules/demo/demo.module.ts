import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { PipelineModule } from '../pipeline/pipeline.module';

import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [DatabaseModule, PipelineModule],
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
