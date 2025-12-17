import { join } from 'path';

import { Global, Module, DynamicModule, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { LoggerModule } from '../../core/logger/logger.module';
import { DatabaseModule } from '../../database';
import { PermissionModule } from '../permission/permission.module';
import { SettingModule } from '../setting/setting.module';
import { ShortcodeModule } from '../shortcode/shortcode.module';

import { PluginHttpController } from './controllers/plugin-http.controller';
import { PluginsController } from './controllers/plugins.controller';
import { WebhookController } from './controllers/webhook.controller';
import { HookService } from './services/hook.service';
import { LoaderService, discoverNestDynamicModules } from './services/loader.service';
import { PluginAPIFactory } from './services/plugin-api.service';
import { PluginConfigService } from './services/plugin-config.service';
import { PluginContextFactory } from './services/plugin-context.service';
import { PluginDataValidator } from './services/plugin-data.validator';
import { PluginHttpRegistryService } from './services/plugin-http-registry.service';
import { PluginRegistryService } from './services/plugin-registry.service';
import { PluginServiceRegistryService } from './services/plugin-service-registry.service';
import { SignalBus } from './services/signal.service';
import { WebhookRegistryService } from './services/webhook-registry.service';
import { WebhookService } from './services/webhook.service';

@Global()
@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    SettingModule,
    ShortcodeModule,
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
  controllers: [PluginsController, PluginHttpController, WebhookController],
  providers: [
    HookService,
    SignalBus,
    PluginContextFactory,
    PluginAPIFactory,
    PluginConfigService,
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
    // v2.0: HTTP 路由注册表
    {
      provide: 'PLUGIN_HTTP_REGISTRY',
      useClass: PluginHttpRegistryService,
    },
    PluginHttpRegistryService,
    // v2.0: 服务注册表
    {
      provide: 'PLUGIN_SERVICE_REGISTRY',
      useClass: PluginServiceRegistryService,
    },
    PluginServiceRegistryService,
  ],
  exports: [
    HookService,
    SignalBus,
    PluginContextFactory,
    PluginAPIFactory,
    PluginConfigService,
    LoaderService,
    PluginRegistryService,
    PluginDataValidator,
    WebhookService,
    WebhookRegistryService,
    PluginHttpRegistryService,
    PluginServiceRegistryService,
  ],
})
export class PluginModule implements OnApplicationBootstrap {
  constructor(
    private readonly hookService: HookService,
    private readonly signalBus: SignalBus,
  ) {}

  onApplicationBootstrap(): void {
    // 输出 hooks 总览日志，方便在全部注册完成后检查
    const logger = new Logger(PluginModule.name);
    try {
      const actionHooks = this.hookService.getAllActionHooks();
      const filterHooks = this.hookService.getAllFilterHooks();
      logger.log(
        `[Hooks] Final summary -> actions=${String(actionHooks.length)}, filters=${String(filterHooks.length)}`,
      );

      // Signal 总览日志
      const syncSignals = this.signalBus.getAllSyncSignalIds();
      const asyncSignals = this.signalBus.getAllAsyncSignalIds();
      logger.log(
        `[Signals] Final summary -> sync=${String(syncSignals.length)}, async=${String(asyncSignals.length)}`,
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

        // Signal 样本日志
        const syncSample = syncSignals.slice(0, 10).join(', ');
        const asyncSample = asyncSignals.slice(0, 10).join(', ');
        if (syncSample.length > 0) {
          logger.log(
            `[Signals] Sync samples: ${syncSample}${syncSignals.length > 10 ? ', ...' : ''}`,
          );
        }
        if (asyncSample.length > 0) {
          logger.log(
            `[Signals] Async samples: ${asyncSample}${asyncSignals.length > 10 ? ', ...' : ''}`,
          );
        }
      }
    } catch (e) {
      logger.error(`Failed to build hooks/signals final summary: ${String(e)}`);
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
