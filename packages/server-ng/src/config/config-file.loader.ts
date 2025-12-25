import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

import { Logger } from '@nestjs/common';

import type { ConfigFactory } from '@nestjs/config';

const logger = new Logger('ConfigFileLoader');

/**
 * 配置文件加载器选项
 */
interface ConfigFileLoaderOptions {
  /** 配置文件路径（相对于项目根目录） */
  path?: string;
  /** 是否必需（如果文件不存在是否抛出错误） */
  required?: boolean;
}

/**
 * 解析 JSON 配置文件
 */
function parseJsonConfig(content: string, filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`JSON 配置文件解析失败 (${filePath}): ${message}`);
    throw new Error(`配置文件解析失败: ${filePath}`);
  }
}

/**
 * 查找配置文件
 *
 * 搜索顺序：
 * 1. config/[NODE_ENV].json（如 config/development.json）
 * 2. config/default.json
 */
function findConfigFile(options: ConfigFileLoaderOptions): string | null {
  const env = process.env.NODE_ENV || 'development';
  const configDir = resolve(process.cwd(), 'config');

  // 如果指定了路径，直接使用
  if (options.path) {
    const fullPath = resolve(process.cwd(), options.path);
    if (existsSync(fullPath)) {
      logger.log(`找到配置文件: ${fullPath}`);
      return fullPath;
    }
    if (options.required) {
      throw new Error(`配置文件不存在: ${fullPath}`);
    }
    return null;
  }

  // 搜索 config/ 目录下的文件（环境配置优先于默认配置）
  const searchPaths = [
    resolve(configDir, `${env}.json`), // config/development.json
    resolve(configDir, 'default.json'), // config/default.json
  ];

  for (const filePath of searchPaths) {
    if (existsSync(filePath)) {
      logger.log(`找到配置文件: ${filePath}`);
      return filePath;
    }
  }

  if (options.required) {
    throw new Error(`未找到配置文件，搜索路径: ${configDir}`);
  }

  return null;
}

/**
 * 创建配置文件加载器（仅支持 JSON 格式）
 *
 * @example
 * ```typescript
 * // 在 ConfigModule 中使用
 * ConfigModule.forRoot({
 *   load: [
 *     createConfigFileLoader(),  // 自动查找 config/development.json 或 config/default.json
 *     // 或指定路径
 *     createConfigFileLoader({ path: 'config/custom.json' }),
 *   ],
 * })
 * ```
 */
export function createConfigFileLoader(options: ConfigFileLoaderOptions = {}): ConfigFactory {
  return () => {
    const filePath = findConfigFile(options);

    if (!filePath) {
      logger.warn('未找到 JSON 配置文件，将仅使用环境变量');
      return {};
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const config = parseJsonConfig(content, filePath);

      logger.log(`✅ 成功加载配置: ${filePath}`);
      logger.log(`   配置项数量: ${String(Object.keys(config).length)}`);

      return config;
    } catch (error) {
      logger.error(`❌ 配置文件加载失败: ${filePath}`, error);
      throw error;
    }
  };
}
