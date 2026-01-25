import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';

import { MetricsController } from './metrics.controller';

@Module({
  imports: [SharedModule],
  controllers: [MetricsController],
})
export class MetricsModule {}
