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
  keywords?: string[];
  vanblog?: unknown;
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
}

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

    // Reload plugins
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

      this.loadedPlugins.delete(pluginName);
      this.pluginContexts.delete(pluginName);

      this.logger.log(`Successfully unloaded plugin: ${pluginName}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to unload plugin ${pluginName}:`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  private async loadPlugins(): Promise<void> {
    try {
      // Plugin directory should be at the same level as data directory
      const pluginsDir = join(process.cwd(), 'plugins');
      this.logger.log(`Scanning plugins directory: ${pluginsDir}`);

      const allPluginDirs: string[] = [];

      // 1. Scan local plugin directories
      try {
        await stat(pluginsDir);
        this.logger.log(`Plugins directory exists: ${pluginsDir}`);
        const localPluginDirs = await this.scanPluginDirectories(pluginsDir);
        allPluginDirs.push(...localPluginDirs);
        this.logger.log(`Found ${String(localPluginDirs.length)} local plugin directories`);
      } catch {
        this.logger.warn(`Plugins directory does not exist: ${pluginsDir}`);
      }

      // 2. Scan npm package plugins in node_modules
      const nodeModulesDir = join(pluginsDir, 'node_modules');
      try {
        await stat(nodeModulesDir);
        this.logger.log(`Scanning npm plugins in: ${nodeModulesDir}`);
        const npmPluginDirs = await this.scanNpmPlugins(nodeModulesDir);
        allPluginDirs.push(...npmPluginDirs);
        this.logger.log(`Found ${String(npmPluginDirs.length)} npm plugin packages`);
      } catch {
        this.logger.log(`No node_modules directory found in plugins directory`);
      }

      this.logger.log(
        `Found ${String(allPluginDirs.length)} total plugin directories: ${JSON.stringify(allPluginDirs)}`,
      );

      for (const pluginDir of allPluginDirs) {
        try {
          this.logger.log(`Attempting to load plugin from: ${pluginDir}`);
          await this.loadPlugin(pluginDir);
        } catch (loadError) {
          this.logger.error(
            `Failed to load plugin from ${pluginDir}:`,
            loadError instanceof Error ? loadError.stack : String(loadError),
          );
        }
      }

      this.logger.log(`Successfully loaded ${String(this.loadedPlugins.size)} plugins`);
    } catch (error) {
      this.logger.error(
        'Failed to load plugins:',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async scanPluginDirectories(pluginsDir: string): Promise<string[]> {
    try {
      const entries = await readdir(pluginsDir, { withFileTypes: true });
      const pluginDirs: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          const pluginPath = join(pluginsDir, entry.name);
          const hasManifest = await this.hasPluginManifest(pluginPath);
          const hasIndex = await this.hasPluginIndex(pluginPath);

          if (hasManifest || hasIndex) {
            pluginDirs.push(pluginPath);
          }
        }
      }

      return pluginDirs;
    } catch (error) {
      if (
        error != null &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        this.logger.warn('Plugins directory does not exist, skipping plugin loading');
        return [];
      }
      throw error;
    }
  }

  private async scanNpmPlugins(nodeModulesDir: string): Promise<string[]> {
    try {
      const entries = await readdir(nodeModulesDir, { withFileTypes: true });
      const pluginDirs: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const packagePath = join(nodeModulesDir, entry.name);

          // Check if it's a VanBlog plugin by looking for package.json with vanblog-plugin keyword
          if (await this.isVanBlogPlugin(packagePath)) {
            pluginDirs.push(packagePath);
          }
        }
      }

      return pluginDirs;
    } catch (error) {
      if (
        error != null &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        this.logger.warn('Node modules directory does not exist');
        return [];
      }
      throw error;
    }
  }

  private async isVanBlogPlugin(packagePath: string): Promise<boolean> {
    try {
      const packageJsonPath = join(packagePath, 'package.json');
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent) as PackageJson;

      // Check if package has vanblog-plugin keyword or starts with vanblog-plugin-
      const hasKeyword = packageJson.keywords?.includes('vanblog-plugin') ?? false;
      const hasPrefix = packageJson.name?.startsWith('vanblog-plugin-') ?? false;
      const hasVanBlogConfig = packageJson.vanblog !== undefined;

      return hasKeyword || hasPrefix || hasVanBlogConfig;
    } catch {
      return false;
    }
  }

  private async hasPluginManifest(pluginDir: string): Promise<boolean> {
    try {
      const manifestPath = join(pluginDir, 'plugin.json');
      await stat(manifestPath);
      return true;
    } catch {
      return false;
    }
  }

  private async hasPluginIndex(pluginDir: string): Promise<boolean> {
    const indexFiles = ['index.js', 'index.mjs', 'index.ts'];
    for (const indexFile of indexFiles) {
      try {
        const indexPath = join(pluginDir, indexFile);
        await stat(indexPath);
        return true;
      } catch {
        // Continue to next file
      }
    }
    return false;
  }

  private async loadPlugin(pluginDir: string): Promise<void> {
    const manifest = await this.loadPluginManifest(pluginDir);

    // Install dependencies if needed
    await this.installPluginDependencies(pluginDir, manifest);

    const plugin = await this.loadPluginModule(pluginDir, manifest);

    if (!plugin) {
      throw new Error('Plugin module did not export a valid plugin object');
    }

    // Create plugin context
    const context = this.pluginContextFactory.createContext(plugin.name);
    this.pluginContexts.set(plugin.name, context);

    // Initialize plugin with timeout and error isolation
    if (plugin.init) {
      await this.safeExecuteWithTimeout(
        async () => plugin.init?.(context),
        60000, // 60s timeout for init
        `Plugin ${plugin.name} initialization`,
      );
    }

    // Register plugin hooks
    if (plugin.hooks) {
      for (const [hookName, hookConfig] of Object.entries(plugin.hooks)) {
        if (hookConfig.type === 'action') {
          this.hookService.addAction(hookName, hookConfig.handler, hookConfig.priority ?? 10);
        } else {
          this.hookService.addFilter(hookName, hookConfig.handler, hookConfig.priority ?? 10);
        }
      }
    }

    this.loadedPlugins.set(plugin.name, plugin);
    this.logger.log(`Successfully loaded plugin: ${plugin.name} v${plugin.version}`);
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

  private async loadPluginModule(
    pluginDir: string,
    manifest: PluginManifest | null,
  ): Promise<Plugin | null> {
    const indexFiles = ['index.mjs', 'index.js', 'index.ts'];
    const mainFile = manifest?.main;

    // Try main file first if specified in manifest
    if (mainFile) {
      try {
        const mainPath = join(pluginDir, mainFile);
        const moduleUrl = pathToFileURL(mainPath).href;
        const pluginModule = (await import(/* @vite-ignore */ moduleUrl)) as {
          [key: string]: unknown;
          default?: Plugin;
        };
        return pluginModule.default ?? (pluginModule as unknown as Plugin);
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
          default?: Plugin;
        };
        return pluginModule.default ?? (pluginModule as unknown as Plugin);
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

      const hasDependencies =
        (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) ??
        (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length > 0);

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
      const timeout = setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(fn())
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error: unknown) => {
          clearTimeout(timeout);
          this.logger.error(
            `${operation} failed:`,
            error instanceof Error ? error.stack : String(error),
          );
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }
}
