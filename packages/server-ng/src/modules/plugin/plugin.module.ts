import { join } from 'path';

import { Global, Module, DynamicModule, Logger } from '@nestjs/common';

import { LoggerModule } from '../../core/logger/logger.module';
import { DatabaseModule } from '../../database';
import { PermissionModule } from '../permission/permission.module';
import { SettingModule } from '../setting/setting.module';

import { PluginsController } from './controllers/plugins.controller';
import { WebhookController } from './controllers/webhook.controller';
import { HookService } from './services/hook.service';
import { LoaderService, discoverNestDynamicModules } from './services/loader.service';
import { PluginContextFactory } from './services/plugin-context.service';
import { WebhookRegistryService } from './services/webhook-registry.service';
import { WebhookService } from './services/webhook.service';

@Global()
@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    SettingModule,
    PermissionModule.forFeature([
      'plugin:install',
      'plugin:uninstall',
      'plugin:enable',
      'plugin:disable',
      'plugin:configure',
    ]),
    PermissionModule.forFeature([
      'webhook:create',
      'webhook:read',
      'webhook:admin',
      'webhook:update',
      'webhook:delete',
      'webhook:test',
      'webhook:trigger',
    ]),
  ],
  controllers: [PluginsController, WebhookController],
  providers: [
    HookService,
    PluginContextFactory,
    LoaderService,
    {
      provide: WebhookService,
      useClass: WebhookService,
    },
    {
      provide: WebhookRegistryService,
      useClass: WebhookRegistryService,
    },
  ],
  exports: [
    HookService,
    PluginContextFactory,
    LoaderService,
    WebhookService,
    WebhookRegistryService,
  ],
})
export class PluginModule {
  static async forRoot(): Promise<DynamicModule> {
    const pluginModules: DynamicModule[] =
      process.env.NODE_ENV === 'test' ? [] : await PluginModule.loadPluginModules();

    return {
      module: PluginModule,
      imports: pluginModules,
    };
  }

  private static async loadPluginModules(): Promise<DynamicModule[]> {
    const logger = new Logger(PluginModule.name);
    const pluginsDir = join(process.cwd(), 'plugins');
    const modules = await discoverNestDynamicModules(pluginsDir, logger);
    return modules;
  }
}
