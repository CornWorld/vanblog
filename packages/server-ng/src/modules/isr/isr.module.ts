import { Module } from '@nestjs/common';

import { IsrController } from './isr.controller';

@Module({
  controllers: [IsrController],
})
export class IsrModule {}
