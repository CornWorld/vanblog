import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

import {
  Injectable,
  OnModuleInit,
  Module,
  Inject,
  Logger,
  type DynamicModule,
} from '@nestjs/common';

import { LoggerService } from '../../../core/logger/logger.service';
import { resolveObjectPluginExport } from '../utils/object-plugin.util';

import { HookService } from './hook.service';
import { PluginContextFactory } from './plugin-context.service';

import type { ActionCallback, FilterCallback } from '../interfaces/hook.interface';
import type { PluginContext } from '../interfaces/plugin-context.interface';

interface PackageJson {
  [key: string]: unknown;
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  keywords?: string[];
  vanblog?: {
    description?: string;
    [k: string]: unknown;
  };
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  main?: string;
  dependencies?: string[];
  hooks?: {
    [hookName: string]: {
      type: 'action' | 'filter';
      priority?: number;
    };
  };
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  hooks?: {
    [hookName: string]:
      | {
          type: 'action';
          priority?: number;
          handler: ActionCallback;
        }
      | {
          type: 'filter';
          priority?: number;
          handler: FilterCallback;
        };
  };
  init?(context: PluginContext): Promise<void> | void;
  destroy?(context: PluginContext): Promise<void> | void;
  // 允许插件暴露自定义方法
  [key: string]: unknown;
}

export type PartialPlugin = Partial<Plugin>;

@Injectable()
export class LoaderService implements OnModuleInit {
  private readonly loadedPlugins = new Map<string, Plugin>();
  private readonly pluginContexts = new Map<string, PluginContext>();
  // Track hook registrations per plugin so we can safely unload/reload without nuking all hooks
  private readonly pluginHookRegistrations = new Map<
    string,
    Array<{ type: 'action' | 'filter'; hookName: string; id: string }>
  >();
  // Track plugin origin directory (for object plugins) to support reload
  private readonly pluginOrigins = new Map<string, string>();

  constructor(
    private readonly logger: LoggerService,
    private readonly pluginContextFactory: PluginContextFactory,
    private readonly hookService: HookService,
  ) {
    this.logger.log('LoaderService initialized');
  }

  onModuleInit(): void {
    this.logger.log(
      'LoaderService: plugin modules are loaded via PluginModule.forRoot, skip internal scanning',
    );
  }

  // 供动态模块适配器注册已加载插件信息，保持语义一致
  registerExternalPlugin(
    plugin: Plugin,
    context: PluginContext,
    meta?: {
      pluginDir?: string;
      hooks?: Array<{ type: 'action' | 'filter'; hookName: string; id: string }>;
    },
  ): void {
    this.loadedPlugins.set(plugin.name, plugin);
    this.pluginContexts.set(plugin.name, context);
    if (meta) {
      if (meta.pluginDir) this.pluginOrigins.set(plugin.name, meta.pluginDir);
      if (meta.hooks) this.pluginHookRegistrations.set(plugin.name, meta.hooks);
    }

    // Log plugin registration and current hooks snapshot for diagnostics
    try {
      const actionHooks = this.hookService.getAllActionHooks();
      const filterHooks = this.hookService.getAllFilterHooks();
      const totalActions = Array.isArray(actionHooks) ? actionHooks.length : 0;
      const totalFilters = Array.isArray(filterHooks) ? filterHooks.length : 0;

      const registeredHooks = (meta?.hooks ?? []).map((h) => `${h.type}:${h.hookName}`);
      const sample = registeredHooks.slice(0, 5).join(', ');

      const pluginMsg = `[Plugin] Registered ${plugin.name}@${plugin.version} with ${registeredHooks.length} hooks`;
      this.logger.log(
        sample.length > 0
          ? `${pluginMsg} (sample: ${sample}${registeredHooks.length > 5 ? ', ...' : ''})`
          : pluginMsg,
      );
      this.logger.log(
        `[Hooks] Totals after registration -> actions=${totalActions}, filters=${totalFilters}`,
      );
    } catch (e) {
      this.logger.debug(`Failed to log hooks snapshot for ${plugin.name}: ${String(e)}`);
    }
  }

  getLoadedPlugins(): Map<string, Plugin> {
    return new Map(this.loadedPlugins);
  }

  getPluginContext(pluginName: string): PluginContext | undefined {
    return this.pluginContexts.get(pluginName);
  }

  async reloadPlugins(): Promise<void> {
    this.logger.log('Reloading all plugins...');

    // Clean up existing plugins without clearing non-plugin hooks
    const names = Array.from(this.loadedPlugins.keys());
    for (const name of names) {
      await this.cleanupPlugin(name);
    }

    // Re-load only object-style plugins we know the origin of
    const origins = names
      .map((n) => this.pluginOrigins.get(n))
      .filter((p): p is string => typeof p === 'string' && p.length > 0);

    for (const dir of origins) {
      try {
        await this.loadPlugin(dir);
      } catch (error) {
        this.logger.error(
          `Failed to reload plugin from ${dir}:`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(`Successfully reloaded ${String(this.loadedPlugins.size)} plugins`);
  }

  async unloadPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginName);
    if (!plugin) {
      return false;
    }

    await this.cleanupPlugin(pluginName);
    return true;
  }

  private async cleanupPlugin(pluginName: string): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginName);
    const context = this.pluginContexts.get(pluginName);

    // 1) call destroy if present
    if (plugin && context && typeof plugin.destroy === 'function') {
      try {
        await plugin.destroy(context);
      } catch (error) {
        this.logger.error(
          `Failed to destroy plugin ${pluginName}:`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    // 2) remove hook registrations only for this plugin
    const regs = this.pluginHookRegistrations.get(pluginName) ?? [];
    for (const r of regs) {
      try {
        if (r.type === 'action') {
          this.hookService.removeAction(r.hookName, r.id);
        } else {
          this.hookService.removeFilter(r.hookName, r.id);
        }
      } catch (error) {
        this.logger.error(
          `Failed to remove ${r.type} for hook '${r.hookName}' of plugin ${pluginName}:`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    // 3) clear registries
    this.pluginHookRegistrations.delete(pluginName);
    this.loadedPlugins.delete(pluginName);
    this.pluginContexts.delete(pluginName);
    // keep origin for potential reload
  }

  // removed unused isVanBlogPlugin

  private getServerVersion(): string {
    // In real scenario, read from package.json or env
    return '2.1.3';
  }

  private parseVersion(v: string): [number, number, number] {
    const nums = v.split('.').map((x) => Number.parseInt(x, 10));
    const a = Number.isFinite(nums[0]) ? nums[0] : 0;
    const b = Number.isFinite(nums[1]) ? nums[1] : 0;
    const c = Number.isFinite(nums[2]) ? nums[2] : 0;
    return [a, b, c];
  }

  private cmp(a: [number, number, number], b: [number, number, number]): number {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2] - b[2];
  }

  private satisfiesVanblogEngine(range: string, version: string): boolean {
    const v = this.parseVersion(version);

    // caret ^x.y.z => >=x.y.z <(x+1).0.0
    if (range.startsWith('^')) {
      const base = this.parseVersion(range.slice(1));
      const upper: [number, number, number] = [base[0] + 1, 0, 0];
      return this.cmp(v, base) >= 0 && this.cmp(v, upper) < 0;
    }

    // tilde ~x.y.z => >=x.y.z <x.(y+1).0
    if (range.startsWith('~')) {
      const base = this.parseVersion(range.slice(1));
      const upper: [number, number, number] = [base[0], base[1] + 1, 0];
      return this.cmp(v, base) >= 0 && this.cmp(v, upper) < 0;
    }

    // comparison operators
    const m = range.match(/^(>=|<=|>|<)\s*(\d+(?:\.\d+){0,2})$/);
    if (m) {
      const [, op, verStr] = m;
      const base = this.parseVersion(verStr);
      switch (op) {
        case '>=':
          return this.cmp(v, base) >= 0;
        case '>':
          return this.cmp(v, base) > 0;
        case '<=':
          return this.cmp(v, base) <= 0;
        case '<':
          return this.cmp(v, base) < 0;
        default:
          return true;
      }
    }

    // exact version or major/minor patterns (numeric only)
    const parts = range.split('.');
    const isNumeric = (s: string): boolean => /^\d+$/.test(s);

    if (parts.length === 1) {
      if (isNumeric(parts[0])) {
        // '2' => 2.x.x
        const base = this.parseVersion(`${parts[0]}.0.0`);
        const upper: [number, number, number] = [base[0] + 1, 0, 0];
        return this.cmp(v, base) >= 0 && this.cmp(v, upper) < 0;
      }
      this.logger.warn(`Unknown Version Range pattern: '${range}', allowing by default.`);
      return true;
    }

    if (parts.length === 2) {
      if (isNumeric(parts[0]) && isNumeric(parts[1])) {
        // '2.1' => 2.1.x
        const base = this.parseVersion(`${parts[0]}.${parts[1]}.0`);
        const upper: [number, number, number] = [base[0], base[1] + 1, 0];
        return this.cmp(v, base) >= 0 && this.cmp(v, upper) < 0;
      }
      this.logger.warn(`Unknown Version Range pattern: '${range}', allowing by default.`);
      return true;
    }

    if (parts.length === 3) {
      if (isNumeric(parts[0]) && isNumeric(parts[1]) && isNumeric(parts[2])) {
        const base = this.parseVersion(range);
        return this.cmp(v, base) === 0;
      }
      this.logger.warn(`Unknown Version Range pattern: '${range}', allowing by default.`);
      return true;
    }

    // unknown patterns: be permissive but warn
    this.logger.warn(`Unknown Version Range pattern: '${range}', allowing by default.`);
    return true;
  }

  private async safeExecuteWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeoutMs: number,
    label: string,
  ): Promise<T | undefined> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<undefined>((resolve) => {
        timeoutHandle = setTimeout(() => {
          resolve(undefined);
        }, timeoutMs);
      });

      const result = (await Promise.race([Promise.resolve(fn()), timeoutPromise])) as T | undefined;
      if (result === undefined) {
        this.logger.warn(`${label} timed out after ${String(timeoutMs)}ms`);
      }
      return result;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private installPluginDependencies(_pluginDir: string, manifest: PluginManifest | null): void {
    // We do not auto-install here to avoid side-effects in server process.
    // Leave a hook or CLI to handle it.
    if (!manifest?.dependencies || manifest.dependencies.length === 0) return;
    this.logger.warn(
      `Plugin '${manifest.name}' declares dependencies: ${manifest.dependencies.join(', ')} (skipped auto-install)`,
    );
  }

  private async loadPlugin(pluginDir: string): Promise<void> {
    const manifest = await this.loadPluginManifest(pluginDir);
    if (!manifest) return;

    const serverVersion = this.getServerVersion();
    const vanRange = (manifest as unknown as PackageJson).engines?.vanblog;
    if (typeof vanRange === 'string' && !this.satisfiesVanblogEngine(vanRange, serverVersion)) {
      this.logger.warn(
        `Plugin '${manifest.name}' requires vanblog engine '${vanRange}', current '${serverVersion}', skipping`,
      );
      return;
    }

    this.installPluginDependencies(pluginDir, manifest);

    const exp = await resolveObjectPluginExport(pluginDir);
    if (exp == null || typeof exp !== 'object') {
      this.logger.warn(`Plugin '${manifest.name}' has no valid export, skipping`);
      return;
    }

    const plugin = exp as PartialPlugin;

    plugin.name ??= manifest.name;
    plugin.version ??= manifest.version;
    plugin.description ??= manifest.description;

    const { name, version } = plugin;
    if (
      typeof name !== 'string' ||
      name.length === 0 ||
      typeof version !== 'string' ||
      version.length === 0
    ) {
      this.logger.warn(`Plugin at ${pluginDir} missing name/version, skipping`);
      return;
    }

    const context = this.pluginContextFactory.createContext(plugin.name);

    // Register hooks and keep ids for targeted unload
    const registrations: Array<{ type: 'action' | 'filter'; hookName: string; id: string }> = [];
    if (plugin.hooks) {
      for (const [hookName, hookConfig] of Object.entries(plugin.hooks)) {
        if (hookConfig.type === 'action') {
          const original = hookConfig.handler;
          const wrapped: ActionCallback = async (...args: unknown[]) => {
            await original(...args, context);
          };
          const id = this.hookService.addAction(hookName, wrapped, hookConfig.priority ?? 10);
          registrations.push({ type: 'action', hookName, id });
        } else {
          const original = hookConfig.handler;
          const wrapped: FilterCallback = async (value: unknown, ...args: unknown[]) => {
            return await original(value, ...args, context);
          };
          const id = this.hookService.addFilter(hookName, wrapped, hookConfig.priority ?? 10);
          registrations.push({ type: 'filter', hookName, id });
        }
      }
    }

    if (typeof plugin.init === 'function') {
      try {
        await this.safeExecuteWithTimeout(
          async () => plugin.init?.(context),
          10_000,
          'plugin.init',
        );
      } catch (error) {
        this.logger.error(
          `Failed to init plugin '${plugin.name}':`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    const full: Plugin = {
      ...(plugin as Plugin),
    };
    this.loadedPlugins.set(full.name, full);
    this.pluginContexts.set(full.name, context);
    this.pluginHookRegistrations.set(full.name, registrations);
    this.pluginOrigins.set(full.name, pluginDir);

    this.logger.log(`Loaded plugin '${full.name}@${full.version}'`);
  }

  private async loadPluginManifest(pluginDir: string): Promise<PluginManifest | null> {
    try {
      // Prefer plugin.json if exists
      const mfPath = join(pluginDir, 'plugin.json');
      const mfContent = await readFile(mfPath, 'utf-8');
      const mf = JSON.parse(mfContent) as PluginManifest;
      if (typeof mf.name !== 'string' || mf.name.length === 0)
        throw new Error('plugin.json must specify name');
      if (typeof mf.version !== 'string' || mf.version.length === 0)
        throw new Error('plugin.json must specify version');

      // optional hooks meta in manifest only provides priorities/types; handlers are in code
      return mf;
    } catch {
      // fallback to package.json
      try {
        const pkg = await this.readPackageJson(pluginDir);
        if (!pkg || (!pkg.name && !pkg.version)) return null;
        const mf: PluginManifest = {
          name: pkg.name ?? 'plugin',
          version: pkg.version ?? '0.0.0',
          description: pkg.description,
        };
        return mf;
      } catch (error) {
        this.logger.error(
          `Failed to read manifest at ${pluginDir}:`,
          error instanceof Error ? error.stack : String(error),
        );
        return null;
      }
    }
  }

  private async readPackageJson(pluginDir: string): Promise<PackageJson | null> {
    try {
      const pkgPath = join(pluginDir, 'package.json');
      const content = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as PackageJson;
      return pkg;
    } catch {
      return null;
    }
  }
}

// ---- 以下为合并自 services/loader.service.ts 的对象插件适配与发现逻辑 ----

// 仅用于对象插件适配的本地接口
interface PluginLike {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  hooks?: {
    [hookName: string]:
      | { type: 'action'; priority?: number; handler: ActionCallback }
      | { type: 'filter'; priority?: number; handler: FilterCallback };
  };
  init?(context: PluginContext): Promise<void> | void;
}

@Injectable()
class PluginObjectAdapter implements OnModuleInit {
  constructor(
    @Inject('PLUGIN_DIR') private readonly pluginDir: string,
    private readonly hookService: HookService,
    private readonly pluginContextFactory: PluginContextFactory,
    private readonly loaderService: LoaderService,
  ) {}

  async onModuleInit(): Promise<void> {
    const exp = await resolveObjectPluginExport(this.pluginDir);
    if (exp == null) return;

    // try read package.json for metadata fallback
    let name: string | undefined;
    let version: string | undefined;
    let description: string | undefined;
    try {
      const pkgPath = join(this.pluginDir, 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent) as {
        name?: string;
        version?: string;
        description?: string;
      };
      name = pkg.name ?? name;
      version = pkg.version ?? version;
      description = pkg.description ?? description;
    } catch {
      /* noop: optional package.json */
    }

    const plugin = exp as PluginLike;
    const finalName = plugin.name ?? name ?? this.pluginDir.split('/').pop() ?? 'plugin';
    const finalVersion = plugin.version ?? version ?? '0.0.0';
    const finalDescription = plugin.description ?? description;

    const context = this.pluginContextFactory.createContext(finalName);

    // register hooks and capture registration ids
    const registrations: Array<{ type: 'action' | 'filter'; hookName: string; id: string }> = [];
    if (plugin.hooks) {
      for (const [hookName, hookConfig] of Object.entries(plugin.hooks)) {
        if (hookConfig.type === 'action') {
          const original = hookConfig.handler;
          const wrapped: ActionCallback = async (...args: unknown[]) => {
            await original(...args, context);
          };
          const id = this.hookService.addAction(hookName, wrapped, hookConfig.priority ?? 10);
          registrations.push({ type: 'action', hookName, id });
        } else {
          const original = hookConfig.handler;
          const wrapped: FilterCallback = async (value: unknown, ...args: unknown[]) => {
            return await original(value, ...args, context);
          };
          const id = this.hookService.addFilter(hookName, wrapped, hookConfig.priority ?? 10);
          registrations.push({ type: 'filter', hookName, id });
        }
      }
    }

    if (typeof plugin.init === 'function') {
      try {
        await Promise.resolve(plugin.init(context));
      } catch {
        /* noop: isolate plugin init failure */
      }
    }

    // sync to loader service for API visibility
    const registered: Plugin = {
      id: finalName,
      name: finalName,
      version: finalVersion,
      ...(finalDescription ? { description: finalDescription } : {}),
      hooks: plugin.hooks,
    } as Plugin;

    this.loaderService.registerExternalPlugin(registered, context, {
      pluginDir: this.pluginDir,
      hooks: registrations,
    });
  }
}

@Module({
  providers: [PluginObjectAdapter],
})
class PluginObjectAdapterModule {}

function createPluginObjectAdapterModule(pluginDir: string): DynamicModule {
  return {
    module: PluginObjectAdapterModule,
    providers: [{ provide: 'PLUGIN_DIR', useValue: pluginDir }, PluginObjectAdapter],
  };
}

export async function discoverNestDynamicModules(
  pluginsDir?: string,
  logger?: Logger,
): Promise<DynamicModule[]> {
  const dir = pluginsDir ?? join(process.cwd(), 'plugins');
  const { loadNestDynamicModules, hasNestModule } = await import('../utils/module-loader.util');
  const nestModules = await loadNestDynamicModules(dir, logger);

  const wrapped: DynamicModule[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      const pluginPath = join(dir, entry.name);
      try {
        if (await hasNestModule(pluginPath)) continue;

        // Heuristic: index.* or {package.json|plugin.json}.main
        let mayBeObject = false;
        const idx = ['index.ts', 'index.js', 'index.mjs'];
        for (const f of idx) {
          try {
            await stat(join(pluginPath, f));
            mayBeObject = true;
            break;
          } catch {
            /* noop: index not exists */
          }
        }
        if (!mayBeObject) {
          try {
            const pkgPath = join(pluginPath, 'package.json');
            const pkgContent = await readFile(pkgPath, 'utf-8');
            const pkg = JSON.parse(pkgContent) as { main?: string };
            if (typeof pkg.main === 'string' && pkg.main.length > 0) mayBeObject = true;
          } catch {
            /* noop: optional package.json */
          }
          if (!mayBeObject) {
            try {
              const mfPath = join(pluginPath, 'plugin.json');
              const mfContent = await readFile(mfPath, 'utf-8');
              const mf = JSON.parse(mfContent) as { main?: string };
              if (typeof mf.main === 'string' && mf.main.length > 0) mayBeObject = true;
            } catch {
              /* noop: optional plugin.json */
            }
          }
        }

        if (mayBeObject) {
          wrapped.push(createPluginObjectAdapterModule(pluginPath));
          logger?.log(`Wrapping plugin object as DynamicModule: ${entry.name}`);
        }
      } catch {
        /* noop: isolate one plugin failure */
      }
    }
  } catch {
    /* noop: no plugins directory */
  }

  return [...nestModules, ...wrapped];
}
