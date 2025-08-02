import { Module } from '@nestjs/common';
import { DemoService } from './demo.service';
import { DemoController } from './demo.controller';
import { DatabaseModule } from '../../database/database.module';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [DatabaseModule, PipelineModule],
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
