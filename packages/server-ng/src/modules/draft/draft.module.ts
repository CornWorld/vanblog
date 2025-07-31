import { Module } from '@nestjs/common';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';
import { DraftVersionService } from './draft-version.service';

@Module({
  controllers: [DraftController],
  providers: [DraftService, DraftVersionService],
  exports: [DraftService, DraftVersionService],
})
export class DraftModule {}
