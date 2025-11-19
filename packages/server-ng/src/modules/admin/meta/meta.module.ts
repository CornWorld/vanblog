import { Module } from '@nestjs/common';

import { AdminMetaController } from './meta.controller';
import { MetaService } from './meta.service';

@Module({
  controllers: [AdminMetaController],
  providers: [MetaService],
})
export class AdminMetaModule {}
