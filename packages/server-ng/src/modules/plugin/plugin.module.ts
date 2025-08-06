import { Module, Global } from '@nestjs/common';

import { CodeSnippetController } from './controllers/code-snippet.controller';
import { CodeSnippetService } from './services/code-snippet.service';
import { HookService } from './services/hook.service';
import { PluginContextFactory } from './services/plugin-context.service';

@Global()
@Module({
  controllers: [CodeSnippetController],
  providers: [HookService, PluginContextFactory, CodeSnippetService],
  exports: [HookService, PluginContextFactory, CodeSnippetService],
})
export class PluginModule {}
