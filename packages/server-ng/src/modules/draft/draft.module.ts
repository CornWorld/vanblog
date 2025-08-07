import { Module } from '@nestjs/common';

import { PluginModule } from '../plugin/plugin.module';

import { DraftVersionService } from './draft-version.service';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';

@Module({
  imports: [PluginModule],
  controllers: [DraftController],
  providers: [DraftService, DraftVersionService],
  exports: [DraftService, DraftVersionService],
})
export class DraftModule {}
