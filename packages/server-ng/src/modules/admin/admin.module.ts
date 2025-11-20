import { Module } from '@nestjs/common';

import { CompatibilityController } from './compatibility.controller';
import { AdminMetaModule } from './meta/meta.module';

@Module({
  imports: [AdminMetaModule],
  controllers: [CompatibilityController],
})
export class AdminModule {}
