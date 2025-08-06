import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';

import { TagController } from './tag.controller';
import { TagService } from './tag.service';

@Module({
  imports: [SharedModule],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
