/**
 * @file plugin/manifest.ts
 *
 * 插件清单 Schema - package.json vanblog 字段定义
 *
 * ## 完整 Schema 示例
 *
 * ```jsonc
 * {
 *   "name": "my-plugin",
 *   "version": "1.0.0",
 *   "description": "插件描述",
 *   "main": "index.ts",
 *   "type": "module",
 *
 *   "vanblog": {
 *     "displayName": "我的插件",
 *     "icon": "🎉",
 *     "engines": {
 *       "vanblog": ">=2.0.0"
 *     },
 *     "pluginDependencies": ["other-plugin"],
 *     "config": {
 *       "enableFeature": {
 *         "type": "boolean",
 *         "default": true,
 *         "title": "启用功能",
 *         "description": "是否启用此功能"
 *       }
 *     },
 *     "hooks": ["article.beforeCreate"],
 *     "publicData": ["rewards"],
 *     "shortcodes": ["gallery"],
 *     "permissions": ["article:read"]
 *   }
 * }
 * ```
 */

import { z } from 'zod';

// ============================================================
// 配置字段类型
// ============================================================

/**
 * 布尔类型配置字段
 */
export const PluginConfigFieldBooleanSchema = z.object({
  type: z.literal('boolean'),
  default: z.boolean().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

/**
 * 数字类型配置字段
 */
export const PluginConfigFieldNumberSchema = z.object({
  type: z.literal('number'),
  default: z.number().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
});

/**
 * 字符串类型配置字段
 */
export const PluginConfigFieldStringSchema = z.object({
  type: z.literal('string'),
  default: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  secret: z.boolean().optional(), // 敏感字段，不在日志中显示
  enum: z.array(z.string()).optional(), // 枚举值
});

/**
 * 数组类型配置字段
 */
export const PluginConfigFieldArraySchema = z.object({
  type: z.literal('array'),
  default: z.array(z.unknown()).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  items: z.object({
    type: z.enum(['string', 'number', 'boolean']),
  }),
});

/**
 * 对象类型配置字段
 */
export const PluginConfigFieldObjectSchema = z.object({
  type: z.literal('object'),
  default: z.record(z.string(), z.unknown()).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

/**
 * 配置字段联合类型
 */
export const PluginConfigFieldSchema = z.union([
  PluginConfigFieldBooleanSchema,
  PluginConfigFieldNumberSchema,
  PluginConfigFieldStringSchema,
  PluginConfigFieldArraySchema,
  PluginConfigFieldObjectSchema,
]);

export type PluginConfigField = z.infer<typeof PluginConfigFieldSchema>;

/**
 * 配置 Schema
 */
export const PluginConfigSchema = z.record(z.string(), PluginConfigFieldSchema);

export type PluginConfig = z.infer<typeof PluginConfigSchema>;

// ============================================================
// 兼容性声明
// ============================================================

/**
 * 引擎兼容性声明
 */
export const PluginEnginesSchema = z.object({
  /** VanBlog 版本要求（semver range） */
  vanblog: z.string().optional(),
  /** Node.js 版本要求（semver range） */
  node: z.string().optional(),
});

export type PluginEngines = z.infer<typeof PluginEnginesSchema>;

// ============================================================
// VanBlog 扩展字段
// ============================================================

/**
 * package.json 中的 vanblog 扩展字段
 */
export const VanBlogManifestSchema = z.object({
  /** 显示名称（可选，默认用 name） */
  displayName: z.string().optional(),

  /** 插件图标（emoji 或 URL） */
  icon: z.string().optional(),

  /** 兼容性声明 */
  engines: PluginEnginesSchema.optional(),

  /** 插件依赖（其他插件 ID） */
  pluginDependencies: z.array(z.string()).optional(),

  /** 配置 Schema（自动生成管理 UI） */
  config: PluginConfigSchema.optional(),

  /** 声明使用的 hooks（用于依赖分析） */
  hooks: z.array(z.string()).optional(),

  /** 声明提供的公共数据 */
  publicData: z.array(z.string()).optional(),

  /** 声明提供的 shortcodes */
  shortcodes: z.array(z.string()).optional(),

  /** 权限要求 */
  permissions: z.array(z.string()).optional(),
});

export type VanBlogManifest = z.infer<typeof VanBlogManifestSchema>;

// ============================================================
// 完整 package.json Schema
// ============================================================

/**
 * 插件 package.json Schema
 */
export const PluginPackageJsonSchema = z.object({
  /** 插件 ID（从目录名或 name 推断） */
  name: z.string(),

  /** 插件版本 */
  version: z.string(),

  /** 插件描述 */
  description: z.string().optional(),

  /** 入口文件 */
  main: z.string().optional().default('index.ts'),

  /** 模块类型 */
  type: z.enum(['module', 'commonjs']).optional().default('module'),

  /** 作者 */
  author: z.string().optional(),

  /** 许可证 */
  license: z.string().optional(),

  /** 主页 */
  homepage: z.string().optional(),

  /** 仓库地址 */
  repository: z
    .union([
      z.string(),
      z.object({
        type: z.string(),
        url: z.string(),
      }),
    ])
    .optional(),

  /** 关键词 */
  keywords: z.array(z.string()).optional(),

  /** VanBlog 扩展字段 */
  vanblog: VanBlogManifestSchema.optional(),
});

export type PluginPackageJson = z.infer<typeof PluginPackageJsonSchema>;

// ============================================================
// 解析后的插件元数据
// ============================================================

/**
 * 解析后的插件元数据（合并 package.json 和 vanblog 字段）
 */
export const PluginMetadataSchema = z.object({
  /** 插件 ID（从目录名推断） */
  id: z.string(),

  /** 插件名称 */
  name: z.string(),

  /** 显示名称 */
  displayName: z.string(),

  /** 版本 */
  version: z.string(),

  /** 描述 */
  description: z.string().optional(),

  /** 图标 */
  icon: z.string().optional(),

  /** 入口文件 */
  main: z.string(),

  /** 插件目录绝对路径 */
  dir: z.string(),

  /** 作者 */
  author: z.string().optional(),

  /** 许可证 */
  license: z.string().optional(),

  /** 主页 */
  homepage: z.string().optional(),

  /** 仓库地址 */
  repository: z.string().optional(),

  /** 关键词 */
  keywords: z.array(z.string()).optional(),

  /** 兼容性声明 */
  engines: PluginEnginesSchema.optional(),

  /** 插件依赖 */
  pluginDependencies: z.array(z.string()).optional(),

  /** 配置 Schema */
  config: PluginConfigSchema.optional(),

  /** 声明的 hooks */
  hooks: z.array(z.string()).optional(),

  /** 声明的公共数据 */
  publicData: z.array(z.string()).optional(),

  /** 声明的 shortcodes */
  shortcodes: z.array(z.string()).optional(),

  /** 权限要求 */
  permissions: z.array(z.string()).optional(),
});

export type PluginMetadata = z.infer<typeof PluginMetadataSchema>;

// ============================================================
// 工具函数
// ============================================================

/**
 * 从 package.json 解析插件元数据
 *
 * @param packageJson - package.json 内容
 * @param dir - 插件目录绝对路径
 * @returns 解析后的插件元数据
 */
export function parsePluginMetadata(packageJson: PluginPackageJson, dir: string): PluginMetadata {
  const vanblog = packageJson.vanblog ?? {};
  const repository =
    typeof packageJson.repository === 'string'
      ? packageJson.repository
      : packageJson.repository?.url;

  return {
    id: extractPluginId(packageJson.name, dir),
    name: packageJson.name,
    displayName: vanblog.displayName ?? packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    icon: vanblog.icon,
    main: packageJson.main ?? 'index.ts',
    dir,
    author: packageJson.author,
    license: packageJson.license,
    homepage: packageJson.homepage,
    repository,
    keywords: packageJson.keywords,
    engines: vanblog.engines,
    pluginDependencies: vanblog.pluginDependencies,
    config: vanblog.config,
    hooks: vanblog.hooks,
    publicData: vanblog.publicData,
    shortcodes: vanblog.shortcodes,
    permissions: vanblog.permissions,
  };
}

/**
 * 从 package.json name 或目录路径提取插件 ID
 */
function extractPluginId(name: string, dir: string): string {
  // 优先使用 package.json 中的 name（去掉 scope）
  if (name) {
    // @scope/plugin-name -> plugin-name
    const match = name.match(/^(?:@[^/]+\/)?(.+)$/);
    if (match) {
      return match[1];
    }
  }
  // 否则使用目录名
  return dir.split('/').pop() ?? name;
}

/**
 * 获取配置字段的默认值
 */
export function getConfigDefaults(config: PluginConfig | undefined): Record<string, unknown> {
  if (!config) return {};

  const defaults: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(config)) {
    if ('default' in field && field.default !== undefined) {
      defaults[key] = field.default;
    }
  }
  return defaults;
}
