import { Module, Global } from '@nestjs/common';

import { HookService } from './services/hook.service';
import { PluginContextFactory } from './services/plugin-context.service';

@Global()
@Module({
  providers: [HookService, PluginContextFactory],
  exports: [HookService, PluginContextFactory],
})
export class PluginModule {}
