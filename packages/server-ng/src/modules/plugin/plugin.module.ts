import { Global, Module, OnModuleInit } from '@nestjs/common';

import { LoggerModule } from '../../core/logger/logger.module';

import { CodeSnippetController } from './controllers/code-snippet.controller';
import { PluginLoaderController } from './controllers/plugin-loader.controller';
import { CodeSnippetService } from './services/code-snippet.service';
import { HookService } from './services/hook.service';
import { PluginContextFactory } from './services/plugin-context.service';
import { PluginLoaderService } from './services/plugin-loader.service';

@Global()
@Module({
  imports: [LoggerModule],
  controllers: [CodeSnippetController, PluginLoaderController],
  providers: [CodeSnippetService, HookService, PluginContextFactory, PluginLoaderService],
  exports: [CodeSnippetService, HookService, PluginContextFactory, PluginLoaderService],
})
export class PluginModule implements OnModuleInit {
  constructor(private readonly pluginLoaderService: PluginLoaderService) {}

  async onModuleInit(): Promise<void> {
    await this.pluginLoaderService.onModuleInit();
  }
}
