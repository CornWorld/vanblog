import { Module, Global } from '@nestjs/common';

import { StatisticsService } from './services/statistics.service';

@Global()
@Module({
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class SharedModule {}
