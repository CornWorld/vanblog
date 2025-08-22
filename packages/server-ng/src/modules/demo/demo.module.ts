import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database';

import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
