/**
 * @file functional-plugin.util.ts
 *
 * 函数式插件加载工具
 *
 * 支持加载函数式插件 `(api) => void`
 */

import { readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';

import { PluginPackageJsonSchema, type PluginPackageJson } from '@vanblog/shared/plugin';

import type { Logger } from '@nestjs/common';
import type { PluginEntry } from '@vanblog/shared/plugin';

/**
 * 插件类型
 */
export type PluginType = 'functional' | 'unknown';

/**
 * 插件加载结果
 */
export interface PluginLoadResult {
  type: PluginType;
  packageJson: PluginPackageJson;
  entry?: PluginEntry;
  dir: string;
}

/**
 * 检测插件类型
 *
 * - functional: 导出函数的插件
 */
export async function detectPluginType(pluginDir: string): Promise<PluginType> {
  try {
    // 尝试加载插件入口
    const entryFile = await findPluginEntry(pluginDir);
    if (!entryFile) return 'unknown';

    const module = await importPluginModule(entryFile);
    if (!module) return 'unknown';

    const defaultExport = module.default;

    // 检查是否为函数
    if (typeof defaultExport === 'function') {
      return 'functional';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * 加载插件
 */
export async function loadFunctionalPlugin(
  pluginDir: string,
  logger?: Logger,
): Promise<PluginLoadResult | null> {
  try {
    // 1. 读取 package.json
    const packageJson = await readPluginPackageJson(pluginDir);
    if (!packageJson) {
      logger?.warn(`No valid package.json found in ${pluginDir}`);
      return null;
    }

    // 2. 找到入口文件
    const entryFile = await findPluginEntry(pluginDir, packageJson.main);
    if (!entryFile) {
      logger?.warn(`No entry file found in ${pluginDir}`);
      return null;
    }

    // 3. 加载模块
    const module = await importPluginModule(entryFile);
    if (!module) {
      logger?.warn(`Failed to import plugin module from ${entryFile}`);
      return null;
    }

    const defaultExport = module.default;

    // 4. 判断类型并返回
    if (typeof defaultExport === 'function') {
      return {
        type: 'functional',
        packageJson,
        entry: defaultExport as PluginEntry,
        dir: pluginDir,
      };
    }

    logger?.warn(`Unknown plugin format in ${pluginDir}, expected function export`);
    return {
      type: 'unknown',
      packageJson,
      dir: pluginDir,
    };
  } catch (error) {
    logger?.error(`Failed to load plugin from ${pluginDir}: ${String(error)}`);
    return null;
  }
}

/**
 * 读取插件 package.json
 */
async function readPluginPackageJson(pluginDir: string): Promise<PluginPackageJson | null> {
  try {
    const pkgPath = join(pluginDir, 'package.json');
    const content = await readFile(pkgPath, 'utf-8');
    const parsed = JSON.parse(content);

    const result = PluginPackageJsonSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }

    // 如果 schema 验证失败，尝试返回基本信息
    if (parsed.name && parsed.version) {
      return {
        name: String(parsed.name),
        version: String(parsed.version),
        description: parsed.description ? String(parsed.description) : undefined,
        main: parsed.main ? String(parsed.main) : 'index.ts',
        type: parsed.type === 'commonjs' ? 'commonjs' : 'module',
        vanblog: parsed.vanblog as PluginPackageJson['vanblog'],
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 查找插件入口文件
 */
async function findPluginEntry(pluginDir: string, mainField?: string): Promise<string | null> {
  // 优先使用 main 字段
  if (mainField) {
    const mainPath = resolve(pluginDir, mainField);
    if (await fileExists(mainPath)) {
      return mainPath;
    }

    // 尝试添加扩展名
    for (const ext of ['.ts', '.js', '.mjs']) {
      const withExt = mainPath.replace(/\.(ts|js|mjs)$/, '') + ext;
      if (await fileExists(withExt)) {
        return withExt;
      }
    }
  }

  // 默认入口文件
  const defaultEntries = ['index.ts', 'index.js', 'index.mjs'];
  for (const entry of defaultEntries) {
    const entryPath = join(pluginDir, entry);
    if (await fileExists(entryPath)) {
      return entryPath;
    }
  }

  return null;
}

/**
 * 动态导入插件模块
 */
async function importPluginModule(entryPath: string): Promise<Record<string, unknown> | null> {
  try {
    // 对于 TypeScript 文件，需要使用 tsx 或已编译的版本
    // 在开发环境中，通常已经通过 ts-node 或 tsx 注册了
    const module = await import(entryPath);
    return module as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}
