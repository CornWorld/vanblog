import { Module, Global } from '@nestjs/common';
import { HookService } from './services/hook.service';

@Global()
@Module({
  providers: [HookService],
  exports: [HookService],
})
export class PluginModule {}
