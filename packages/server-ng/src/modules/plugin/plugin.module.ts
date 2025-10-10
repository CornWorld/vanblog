import { join } from 'path';

import { Global, Module, DynamicModule, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { LoggerModule } from '../../core/logger/logger.module';
import { DatabaseModule } from '../../database';
import { PermissionModule } from '../permission/permission.module';
import { SettingModule } from '../setting/setting.module';

import { PluginsController } from './controllers/plugins.controller';
import { WebhookController } from './controllers/webhook.controller';
import { HookService } from './services/hook.service';
import { LoaderService, discoverNestDynamicModules } from './services/loader.service';
import { PluginContextFactory } from './services/plugin-context.service';
import { PluginDataValidator } from './services/plugin-data.validator';
import { PluginRegistryService } from './services/plugin-registry.service';
import { WebhookRegistryService } from './services/webhook-registry.service';
import { WebhookService } from './services/webhook.service';

@Global()
@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    SettingModule,
    PermissionModule.forFeature([
      'plugin:read',
      'plugin:disable',
      'plugin:configure',
      'plugin:install',
      'plugin:uninstall',
      'plugin:enable',
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
    PluginRegistryService,
    PluginDataValidator,
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
    PluginRegistryService,
    PluginDataValidator,
    WebhookService,
    WebhookRegistryService,
  ],
})
export class PluginModule implements OnApplicationBootstrap {
  constructor(private readonly hookService: HookService) {}

  onApplicationBootstrap(): void {
    // 输出 hooks 总览日志，方便在全部注册完成后检查
    const logger = new Logger(PluginModule.name);
    try {
      const actionHooks = this.hookService.getAllActionHooks();
      const filterHooks = this.hookService.getAllFilterHooks();
      logger.log(
        `[Hooks] Final summary -> actions=${actionHooks.length}, filters=${filterHooks.length}`,
      );

      if (process.env.NODE_ENV !== 'production') {
        const actionSample = actionHooks.slice(0, 10).join(', ');
        const filterSample = filterHooks.slice(0, 10).join(', ');
        if (actionSample.length > 0) {
          logger.log(
            `[Hooks] Action samples: ${actionSample}${actionHooks.length > 10 ? ', ...' : ''}`,
          );
        }
        if (filterSample.length > 0) {
          logger.log(
            `[Hooks] Filter samples: ${filterSample}${filterHooks.length > 10 ? ', ...' : ''}`,
          );
        }
      }
    } catch (e) {
      logger.error(`Failed to build hooks final summary: ${String(e)}`);
    }
  }

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
