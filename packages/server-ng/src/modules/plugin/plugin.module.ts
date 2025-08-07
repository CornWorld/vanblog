import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';

import { Global, Module, DynamicModule, Logger } from '@nestjs/common';

import { LoggerModule } from '../../core/logger/logger.module';

import { CodeSnippetController } from './controllers/code-snippet.controller';
import { PluginLoaderController } from './controllers/plugin-loader.controller';
import { CodeSnippetService } from './services/code-snippet.service';
import { HookService } from './services/hook.service';
import { PluginContextFactory } from './services/plugin-context.service';
import { PluginLoaderService } from './services/plugin-loader.service';

// 定义插件模块类型
type PluginModuleExports = {
  [key: string]: unknown;
  default?: DynamicModule | (() => DynamicModule);
  PluginModule?: DynamicModule | (() => DynamicModule);
};

type PluginModuleConstructor = DynamicModule | (() => DynamicModule);

@Global()
@Module({
  imports: [LoggerModule],
  controllers: [CodeSnippetController, PluginLoaderController],
  providers: [CodeSnippetService, HookService, PluginContextFactory, PluginLoaderService],
  exports: [CodeSnippetService, HookService, PluginContextFactory, PluginLoaderService],
})
export class PluginModule {
  static async forRoot(): Promise<DynamicModule> {
    const pluginModules = await PluginModule.loadPluginModules();

    return {
      module: PluginModule,
      imports: pluginModules,
    };
  }

  private static async loadPluginModules(): Promise<DynamicModule[]> {
    const logger = new Logger(PluginModule.name);
    const pluginModules: DynamicModule[] = [];
    const pluginsDir = join(process.cwd(), 'plugins');

    try {
      await stat(pluginsDir);
      const entries = await readdir(pluginsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          const pluginPath = join(pluginsDir, entry.name);

          try {
            // Check for module.ts or index.ts that exports a NestJS module
            const possibleModuleFiles = ['module.ts', 'index.ts', 'plugin.module.ts'];

            for (const moduleFile of possibleModuleFiles) {
              const modulePath = join(pluginPath, moduleFile);

              try {
                await stat(modulePath);

                // Import the module dynamically
                const moduleUrl = pathToFileURL(modulePath).href;
                const moduleExports: unknown = await import(moduleUrl);

                // Look for a default export or a module export
                const typedExports = moduleExports as PluginModuleExports;
                const pluginModule: PluginModuleConstructor | undefined =
                  typedExports.default ??
                  typedExports.PluginModule ??
                  (typedExports[`${entry.name}Module`] as PluginModuleConstructor | undefined);

                if (pluginModule) {
                  logger.log(`Loading plugin module: ${entry.name}`);
                  const moduleInstance =
                    typeof pluginModule === 'function' ? pluginModule() : pluginModule;
                  pluginModules.push(moduleInstance);
                  logger.log(`${entry.name}Module has been loaded!`);
                  break; // Found a valid module, stop looking for other files
                }
              } catch {
                // File doesn't exist or can't be imported, try next file
                continue;
              }
            }
          } catch (pluginError) {
            logger.error(`Error loading plugin ${entry.name}:`, pluginError);
          }
        }
      }
    } catch {
      logger.log('Plugins directory does not exist, skipping dynamic module loading');
    }

    logger.log(`Dynamically loading ${String(pluginModules.length)} plugin modules`);
    return pluginModules;
  }
}
