import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { SettingModule } from '../setting/setting.module';
import { PluginModule } from '../plugin/plugin.module';

@Module({
  imports: [SettingModule, PluginModule],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
