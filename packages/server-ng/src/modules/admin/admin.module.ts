import { Module } from '@nestjs/common';

import { CompatibilityController } from './compatibility.controller';

@Module({
  controllers: [CompatibilityController],
})
export class AdminModule {}
