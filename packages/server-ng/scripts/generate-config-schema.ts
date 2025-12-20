#!/usr/bin/env tsx
/**
 * 从 Zod Schema 生成 JSON Schema（集成版本系统）
 *
 * 功能：
 * - 自动读取 root package.json 的版本号
 * - 生成带版本信息的 JSON Schema
 * - 输出多个版本：
 *   - config.schema.json (latest)
 *   - config.v{version}.schema.json (versioned)
 *
 * 集成点：
 * - prebuild: 构建前自动生成
 * - predev: 开发前自动生成
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { configSchema } from '../src/config/config.schema';

/**
 * 读取版本信息
 */
function getVersion(): { version: string; environment: 'production' | 'development' } {
  const rootPackageJsonPath = resolve(__dirname, '../../../package.json');
  const serverPackageJsonPath = resolve(__dirname, '../package.json');

  // 优先使用 root package.json 的版本（monorepo 统一版本）
  const packageJsonPath = existsSync(rootPackageJsonPath)
    ? rootPackageJsonPath
    : serverPackageJsonPath;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const version = packageJson.version || '0.0.0';

  // 判断环境：包含 dev/alpha/beta/rc 为开发版
  const isDev = /-(dev|alpha|beta|rc|corn)/.test(version);
  const environment = isDev ? 'development' : 'production';

  return { version, environment };
}

/**
 * 生成配置的 JSON Schema
 */
function generateConfigJsonSchema(version: string, environment: string) {
  // 使用 Zod 原生的 toJSONSchema() 方法
  const jsonSchema = z.toJSONSchema(configSchema);

  // 增强 JSON Schema：添加版本信息、元数据、示例
  const enhancedSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: `https://vanblog.mereith.com/schemas/config.${version}.json`,
    version, // 添加版本字段
    environment, // 添加环境标识
    title: 'VanBlog 配置',
    description: `VanBlog server-ng 的完整配置定义（版本: ${version}）`,
    ...jsonSchema,
    // 添加示例配置
    examples: [
      {
        PORT: 3050,
        NODE_ENV: 'development',
        API_PREFIX: 'api',
        API_VERSION: 'v2',
        DATABASE_DRIVER: 'local',
        DATABASE_URL: 'file:./data/vanblog.db',
        JWT_SECRET: 'your-secret-key-at-least-32-characters-long-for-security',
        JWT_EXPIRES_IN: '7d',
        JWT_REFRESH_SECRET: 'your-refresh-secret-at-least-32-characters-long-too',
        JWT_REFRESH_EXPIRES_IN: '30d',
        CORS_ORIGIN: 'http://localhost:3001,http://localhost:3002',
        CORS_CREDENTIALS: true,
        UPLOAD_MAX_FILE_SIZE: 52428800,
        UPLOAD_DESTINATION: './uploads',
        LOG_LEVEL: 'info',
        DEMO_MODE: false,
      },
    ],
  };

  return enhancedSchema;
}

/**
 * 主函数
 */
function main() {
  const { version, environment } = getVersion();
  const schema = generateConfigJsonSchema(version, environment);
  const baseDir = resolve(__dirname, '..');

  // 1. 生成 latest 版本（config.schema.json）
  const latestPath = resolve(baseDir, 'config.schema.json');
  writeFileSync(latestPath, JSON.stringify(schema, null, 2), 'utf-8');

  // 2. 生成带版本号的文件（config.v0.54.0-corn.6.schema.json）
  const versionedPath = resolve(baseDir, `config.v${version}.schema.json`);
  writeFileSync(versionedPath, JSON.stringify(schema, null, 2), 'utf-8');

  // 输出结果
  const envLabel = environment === 'development' ? '🔧 Dev' : '🚀 Prod';
  process.stdout.write(`${envLabel} JSON Schema generated (v${version})\n`);
  process.stdout.write(`  ├─ ${latestPath}\n`);
  process.stdout.write(`  └─ ${versionedPath}\n`);
}

main();
