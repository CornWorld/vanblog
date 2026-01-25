import { Module } from '@nestjs/common';

import { PluginModule } from '../plugin/plugin.module';
import { SettingModule } from '../setting/setting.module';

import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

@Module({
  imports: [SettingModule, PluginModule],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
