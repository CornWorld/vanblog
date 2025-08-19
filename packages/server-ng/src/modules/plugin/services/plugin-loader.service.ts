import { spawn } from 'child_process';
import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { LoggerService } from '../../../core/logger/logger.service';

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
export class PluginLoaderService implements OnModuleInit {
  private readonly loadedPlugins = new Map<string, Plugin>();
  private readonly pluginContexts = new Map<string, PluginContext>();

  constructor(
    private readonly logger: LoggerService,
    private readonly pluginContextFactory: PluginContextFactory,
    private readonly hookService: HookService,
  ) {
    this.logger.log('PluginLoaderService initialized');
  }

  async onModuleInit(): Promise<void> {
    // In test environments, skip automatic plugin loading to avoid side effects
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      this.logger.log(
        'PluginLoaderService: Test environment detected, skipping automatic plugin loading',
      );
      return;
    }
    this.logger.log('PluginLoaderService: Starting automatic plugin loading on module init...');
    await this.loadPlugins();
  }

  getLoadedPlugins(): Map<string, Plugin> {
    return new Map(this.loadedPlugins);
  }

  getPluginContext(pluginName: string): PluginContext | undefined {
    return this.pluginContexts.get(pluginName);
  }

  async reloadPlugins(): Promise<void> {
    this.logger.log('Reloading all plugins...');

    // Destroy existing plugins
    for (const [pluginName, plugin] of this.loadedPlugins) {
      try {
        const context = this.pluginContexts.get(pluginName);
        if (plugin.destroy && context) {
          await plugin.destroy(context);
        }
      } catch (error) {
        this.logger.error(
          `Failed to destroy plugin ${pluginName}:`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    // Clear loaded plugins and contexts
    this.loadedPlugins.clear();
    this.pluginContexts.clear();

    // Clear hooks (this will remove all registered hooks)
    this.hookService.clearAll();

    // Load plugins again
    await this.loadPlugins();
  }

  async unloadPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginName);
    if (!plugin) {
      return false;
    }

    try {
      const context = this.pluginContexts.get(pluginName);
      if (plugin.destroy && context) {
        await plugin.destroy(context);
      }
    } catch (error) {
      this.logger.error(
        `Failed to destroy plugin ${pluginName}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    this.loadedPlugins.delete(pluginName);
    this.pluginContexts.delete(pluginName);
    return true;
  }

  private async loadPlugins(): Promise<void> {
    const pluginDirectories: string[] = [];
    const pluginsDir = join(process.cwd(), 'plugins');

    // Scan plugins directory
    try {
      const localPlugins = await this.scanPluginDirectories(pluginsDir);
      pluginDirectories.push(...localPlugins);
      this.logger.log(`Found ${localPlugins.length} local plugins in ${pluginsDir}`);
    } catch (_error) {
      this.logger.log(`No local plugins directory found: ${pluginsDir}`);
    }

    // Scan npm plugins in node_modules
    try {
      const nodeModulesDir = join(process.cwd(), 'node_modules');
      const npmPlugins = await this.scanNpmPlugins(nodeModulesDir);
      pluginDirectories.push(...npmPlugins);
      this.logger.log(`Found ${npmPlugins.length} npm plugins in node_modules`);
    } catch (_error) {
      this.logger.log('No node_modules directory found or unable to scan npm plugins');
    }

    // Load each plugin
    for (const pluginDir of pluginDirectories) {
      try {
        await this.loadPlugin(pluginDir);
      } catch (error) {
        this.logger.error(
          `Failed to load plugin from ${pluginDir}:`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(`Successfully loaded ${this.loadedPlugins.size} plugins`);
  }

  private async scanPluginDirectories(pluginsDir: string): Promise<string[]> {
    const plugins: string[] = [];

    try {
      const entries = await readdir(pluginsDir);

      for (const entry of entries) {
        const pluginPath = join(pluginsDir, entry);
        const isDir = (await stat(pluginPath)).isDirectory();

        if (isDir) {
          const hasManifest = await this.hasPluginManifest(pluginPath);
          const hasIndex = await this.hasPluginIndex(pluginPath);

          if (hasManifest || hasIndex) {
            plugins.push(pluginPath);
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to scan plugin directories in ${pluginsDir}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return plugins;
  }

  private async scanNpmPlugins(nodeModulesDir: string): Promise<string[]> {
    const npmPlugins: string[] = [];

    try {
      const entries = await readdir(nodeModulesDir);

      for (const entry of entries) {
        // Skip .bin directory and other special directories
        if (entry.startsWith('.')) continue;

        // Handle scoped packages
        if (entry.startsWith('@')) {
          const scopeDir = join(nodeModulesDir, entry);
          const scopedEntries = await readdir(scopeDir);

          for (const scopedEntry of scopedEntries) {
            const packagePath = join(scopeDir, scopedEntry);
            if (await this.isVanBlogPlugin(packagePath)) {
              npmPlugins.push(packagePath);
            }
          }
        } else {
          const packagePath = join(nodeModulesDir, entry);
          if (await this.isVanBlogPlugin(packagePath)) {
            npmPlugins.push(packagePath);
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to scan npm plugins in ${nodeModulesDir}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return npmPlugins;
  }

  private async isVanBlogPlugin(packagePath: string): Promise<boolean> {
    try {
      const packageJsonPath = join(packagePath, 'package.json');
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent) as PackageJson;

      // Check if it's a VanBlog plugin
      if (Array.isArray(packageJson.keywords)) {
        if (packageJson.keywords.includes('vanblog-plugin')) return true;
        if (packageJson.keywords.includes('vanblog')) return true;
      }
      if (packageJson.vanblog !== undefined) return true;
      return false;
    } catch {
      return false;
    }
  }

  private async hasPluginManifest(pluginDir: string): Promise<boolean> {
    try {
      await stat(join(pluginDir, 'plugin.json'));
      return true;
    } catch {
      return false;
    }
  }

  private async hasPluginIndex(pluginDir: string): Promise<boolean> {
    const indexFiles = ['index.mjs', 'index.js', 'index.ts'];

    for (const indexFile of indexFiles) {
      try {
        await stat(join(pluginDir, indexFile));
        return true;
      } catch {
        // Continue to next file
      }
    }
    return false;
  }

  private getServerVersion(): string {
    return '2.0.0'; // This should come from package.json or environment
  }

  private parseVersion(v: string): [number, number, number] {
    const parts = v.split('.').map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  }

  private cmp(a: [number, number, number], b: [number, number, number]): number {
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  }

  private satisfiesVanblogEngine(range: string, version: string): boolean {
    const trimmed = range.trim();
    const v = this.parseVersion(version);

    // ^2.0.0 => >=2.0.0 <3.0.0
    const caret = trimmed.match(/^\^(\d+)\.(\d+)\.(\d+)$/);
    if (caret) {
      const low: [number, number, number] = [Number(caret[1]), Number(caret[2]), Number(caret[3])];
      const high: [number, number, number] = [low[0] + 1, 0, 0];
      return this.cmp(v, low) >= 0 && this.cmp(v, high) < 0;
    }

    // ~2.1.3 => >=2.1.3 <2.2.0
    const tilde = trimmed.match(/^~(\d+)\.(\d+)\.(\d+)$/);
    if (tilde) {
      const low: [number, number, number] = [Number(tilde[1]), Number(tilde[2]), Number(tilde[3])];
      const high: [number, number, number] = [low[0], low[1] + 1, 0];
      return this.cmp(v, low) >= 0 && this.cmp(v, high) < 0;
    }

    // >=2.0.0, >2.0.0, <=, <
    const comp = trimmed.match(/^(>=|>|<=|<)\s*(\d+)\.(\d+)\.(\d+)$/);
    if (comp) {
      const op = comp[1] as '>=' | '>' | '<=' | '<';
      const target: [number, number, number] = [Number(comp[2]), Number(comp[3]), Number(comp[4])];
      const c = this.cmp(v, target);
      if (op === '>=') return c >= 0;
      if (op === '>') return c > 0;
      if (op === '<=') return c <= 0;
      return c < 0;
    }

    // Exact 2.0.0
    const exact = trimmed.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (exact) {
      const target: [number, number, number] = [
        Number(exact[1]),
        Number(exact[2]),
        Number(exact[3]),
      ];
      return this.cmp(v, target) === 0;
    }

    // Fallbacks for simple forms
    // '2' => match major only
    if (/^\d+$/.test(trimmed)) {
      const maj = Number(trimmed);
      return v[0] === maj;
    }

    // '2.1' => match major.minor
    if (/^\d+\.\d+$/.test(trimmed)) {
      const [majStr, minStr] = trimmed.split('.');
      const maj = Number(majStr);
      const min = Number(minStr);
      return v[0] === maj && v[1] === min;
    }

    // Unknown pattern: be permissive (do not block)
    this.logger.warn(`Unknown engines.vanblog range pattern: "${trimmed}", allowing by default`);
    return true;
  }

  private async loadPlugin(pluginDir: string): Promise<void> {
    const manifest = await this.loadPluginManifest(pluginDir);

    // Read package.json for engines, main, name, version and vanblog metadata
    const pkg = await this.readPackageJson(pluginDir);

    // Enforce engines.vanblog if provided
    const required = pkg?.engines?.vanblog;
    if (typeof required === 'string' && required !== '') {
      const serverVersion = this.getServerVersion();
      if (!this.satisfiesVanblogEngine(required, serverVersion)) {
        this.logger.warn(
          `Skip loading plugin in ${pluginDir} due to engines.vanblog (required: ${required}, server: ${serverVersion})`,
        );
        return;
      }
    }

    // Install dependencies if needed
    await this.installPluginDependencies(pluginDir, manifest);

    const plugin = await this.loadPluginModule(pluginDir, manifest, pkg);

    if (!plugin) {
      throw new Error('Plugin module did not export a valid plugin object');
    }

    // Merge metadata with fallback from package.json (plugin export may omit them)
    const pluginData: PartialPlugin = { ...plugin };

    const finalName =
      (typeof pluginData.name === 'string' && pluginData.name !== ''
        ? pluginData.name
        : undefined) ?? (typeof pkg?.name === 'string' && pkg.name !== '' ? pkg.name : undefined);

    const finalVersion =
      (typeof pluginData.version === 'string' && pluginData.version !== ''
        ? pluginData.version
        : undefined) ??
      (typeof pkg?.version === 'string' && pkg.version !== '' ? pkg.version : undefined);

    // Prefer package.json.vanblog.description over npm description
    const finalDescription =
      (typeof pluginData.description === 'string' && pluginData.description !== ''
        ? pluginData.description
        : undefined) ??
      (typeof pkg?.vanblog?.description === 'string' && pkg.vanblog.description !== ''
        ? pkg.vanblog.description
        : undefined) ??
      (typeof pkg?.description === 'string' && pkg.description !== ''
        ? pkg.description
        : undefined);

    if (!finalName || !finalVersion) {
      throw new Error(
        `Plugin in ${pluginDir} must export name/version or specify them in package.json`,
      );
    }

    const finalPlugin: Plugin = {
      ...pluginData,
      id: pluginData.id ?? finalName,
      name: finalName,
      version: finalVersion,
      ...(finalDescription ? { description: finalDescription } : {}),
    };

    // Create plugin context
    const context = this.pluginContextFactory.createContext(finalPlugin.name);
    this.pluginContexts.set(finalPlugin.name, context);

    // Initialize plugin with timeout and error isolation
    if (finalPlugin.init) {
      await this.safeExecuteWithTimeout(
        async () => finalPlugin.init?.(context),
        60000, // 60s timeout for init
        `Plugin ${finalPlugin.name} initialization`,
      );
    }

    // Register plugin hooks (must come from code, not JSON)
    if (finalPlugin.hooks) {
      for (const [hookName, hookConfig] of Object.entries(finalPlugin.hooks)) {
        if (hookConfig.type === 'action') {
          const original = hookConfig.handler;
          const wrapped: ActionCallback = async (...args: unknown[]) => {
            // 将 plugin context 作为最后一个参数传递给回调
            await original(...args, context);
          };
          this.hookService.addAction(hookName, wrapped, hookConfig.priority ?? 10);
        } else {
          const original = hookConfig.handler;
          const wrapped: FilterCallback = async (value: unknown, ...args: unknown[]) => {
            // 将 plugin context 作为最后一个参数传递给过滤器回调
            return await original(value, ...args, context);
          };
          this.hookService.addFilter(hookName, wrapped, hookConfig.priority ?? 10);
        }
      }
    }

    this.loadedPlugins.set(finalPlugin.name, finalPlugin);
    this.logger.log(`Successfully loaded plugin: ${finalPlugin.name} v${finalPlugin.version}`);
  }

  private async loadPluginManifest(pluginDir: string): Promise<PluginManifest | null> {
    try {
      const manifestPath = join(pluginDir, 'plugin.json');
      const manifestContent = await readFile(manifestPath, 'utf-8');
      return JSON.parse(manifestContent) as PluginManifest;
    } catch {
      return null;
    }
  }

  private async readPackageJson(pluginDir: string): Promise<PackageJson | null> {
    try {
      const packageJsonPath = join(pluginDir, 'package.json');
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      return JSON.parse(packageJsonContent) as PackageJson;
    } catch {
      return null;
    }
  }

  private async loadPluginModule(
    pluginDir: string,
    manifest: PluginManifest | null,
    pkg: PackageJson | null,
  ): Promise<PartialPlugin | null> {
    const indexFiles = ['index.mjs', 'index.js', 'index.ts'];
    const mainFile = pkg?.main ?? manifest?.main;

    // Try main file from package.json (preferred) then manifest
    if (typeof mainFile === 'string' && mainFile !== '') {
      try {
        const mainPath = join(pluginDir, mainFile);
        const moduleUrl = pathToFileURL(mainPath).href;
        const pluginModule = (await import(/* @vite-ignore */ moduleUrl)) as {
          [key: string]: unknown;
          default?: PartialPlugin;
        };
        return (pluginModule.default ?? (pluginModule as unknown)) as PartialPlugin;
      } catch (loadError) {
        this.logger.warn(
          `Failed to load main file ${mainFile}, trying index files:`,
          String(loadError),
        );
      }
    }

    // Try index files
    for (const indexFile of indexFiles) {
      try {
        const indexPath = join(pluginDir, indexFile);
        await stat(indexPath);
        const moduleUrl = pathToFileURL(indexPath).href;
        const pluginModule = (await import(/* @vite-ignore */ moduleUrl)) as {
          [key: string]: unknown;
          default?: PartialPlugin;
        };
        return (pluginModule.default ?? (pluginModule as unknown)) as PartialPlugin;
      } catch {
        // Continue to next file
      }
    }

    return null;
  }

  private async installPluginDependencies(
    pluginDir: string,
    _manifest: PluginManifest | null,
  ): Promise<void> {
    // Check if plugin has package.json with dependencies
    const packageJsonPath = join(pluginDir, 'package.json');
    try {
      await stat(packageJsonPath);
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent) as PackageJson & {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const depsCount = Object.keys(packageJson.dependencies ?? {}).length;
      const devDepsCount = Object.keys(packageJson.devDependencies ?? {}).length;
      const hasDependencies = depsCount + devDepsCount > 0;

      if (hasDependencies) {
        const nodeModulesPath = join(pluginDir, 'node_modules');
        try {
          await stat(nodeModulesPath);
          this.logger.log(`Dependencies already installed for plugin in ${pluginDir}`);
        } catch {
          this.logger.log(`Installing dependencies for plugin in ${pluginDir}`);
          await this.runPnpmInstall(pluginDir);
        }
      }
    } catch {
      // No package.json or no dependencies, skip installation
    }
  }

  private async runPnpmInstall(pluginDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('pnpm', ['install'], {
        cwd: pluginDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          this.logger.log(`Dependencies installed successfully in ${pluginDir}`);
          resolve();
        } else {
          this.logger.error(
            `Failed to install dependencies in ${pluginDir}. Exit code: ${code}\nStdout: ${stdout}\nStderr: ${stderr}`,
          );
          reject(new Error(`pnpm install failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        this.logger.error(`Failed to spawn pnpm install process: ${error.message}`);
        reject(error);
      });
    });
  }

  private async safeExecuteWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeoutMs: number,
    operation: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(fn())
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }
}
