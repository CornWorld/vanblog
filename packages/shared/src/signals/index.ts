/**
 * @file signals/index.ts
 *
 * VanBlog Signal 机制 - 主入口
 *
 * ## 概述
 *
 * Signal 是 VanBlog 插件系统的核心通信机制，比传统的 Hook 系统更加类型安全和优雅。
 *
 * ## 核心概念
 *
 * - **Signal**: 代码对象，而非字符串标识符，提供 IDE 跳转和类型推导
 * - **SyncSignal**: 同步信号，可修改数据（命名约定：`beforeXxx`）
 * - **AsyncSignal**: 异步信号，用于副作用（命名约定：`afterXxx`）
 *
 * ## 使用示例
 *
 * ```typescript
 * import { signals } from '@vanblog/shared/signals';
 *
 * // 插件连接同步 Signal（可修改数据）
 * signalBus.connect(signals.article.beforeCreate, (article) => ({
 *   ...article,
 *   title: article.title + '喵',
 * }));
 *
 * // 插件订阅异步 Signal（副作用）
 * signalBus.subscribe(signals.article.afterCreate, (article) => {
 *   console.log(`Created: ${article.id} - ${article.title}`);
 * });
 *
 * // 业务代码发送 Signal
 * const filtered = await signalBus.send(signals.article.beforeCreate, articleData);
 * await signalBus.emit(signals.article.afterCreate, savedArticle);
 * ```
 *
 * ## API 语义
 *
 * | 方法 | 用途 | 返回 |
 * |------|------|------|
 * | `connect()` | 连接同步 Signal，可修改数据 | 断开连接函数 |
 * | `subscribe()` | 订阅异步 Signal，仅接收通知 | 取消订阅函数 |
 * | `send()` | 发送同步 Signal，等待数据修改 | 修改后的数据 |
 * | `emit()` | 发送异步 Signal，不等待响应 | void |
 */

import { z } from 'zod';

// 导出类型
export * from './types.js';

// 导入各模块 Signal 定义
import { articleSignals } from './definitions/article.signals.js';
import { userSignals } from './definitions/user.signals.js';
import { draftSignals } from './definitions/draft.signals.js';
import { mediaSignals } from './definitions/media.signals.js';
import { categorySignals } from './definitions/category.signals.js';
import { tagSignals } from './definitions/tag.signals.js';
import { settingSignals } from './definitions/setting.signals.js';
import { rssSignals } from './definitions/rss.signals.js';
import { bootstrapSignals } from './definitions/bootstrap.signals.js';
import { webhookSignals } from './definitions/webhook.signals.js';
import { systemSignals } from './definitions/system.signals.js';

// ============================================================
// Signal 定义聚合
// ============================================================

/**
 * VanBlog 所有 Signal 定义
 *
 * @example
 * ```typescript
 * import { signals } from '@vanblog/shared/signals';
 *
 * // IDE 自动补全：signals.article.beforeCreate
 * // Cmd+Click 跳转到定义
 * signalBus.connect(signals.article.beforeCreate, (article) => {
 *   // article 类型自动推导为 $ArticleIns
 *   return { ...article, title: article.title + '喵' };
 * });
 * ```
 */
export const signals = {
  /** 文章模块 Signal */
  article: articleSignals,
  /** 用户模块 Signal */
  user: userSignals,
  /** 草稿模块 Signal */
  draft: draftSignals,
  /** 媒体/文件模块 Signal */
  media: mediaSignals,
  /** 分类模块 Signal */
  category: categorySignals,
  /** 标签模块 Signal */
  tag: tagSignals,
  /** 设置模块 Signal */
  setting: settingSignals,
  /** RSS 模块 Signal */
  rss: rssSignals,
  /** Bootstrap 模块 Signal */
  bootstrap: bootstrapSignals,
  /** Webhook 模块 Signal */
  webhook: webhookSignals,
  /** 系统级 Signal */
  system: systemSignals,
} as const;

// ============================================================
// 运行时 Schema Registry
// ============================================================

/**
 * Signal Schema 注册表
 *
 * 用于：
 * 1. 运行时查找 Signal 的 Zod Schema
 * 2. 向后兼容：支持字符串形式的 Signal ID 查找
 * 3. 校验未知来源的数据
 */
export const signalSchemaRegistry = new Map<string, z.ZodType>();

/**
 * Signal 元数据注册表
 *
 * 存储 Signal 的描述、类型等元数据
 */
export const signalMetaRegistry = new Map<
  string,
  {
    type: 'sync' | 'async';
    description?: string;
    module: string;
    name: string;
  }
>();

// 自动注册所有 Signal
function registerSignals() {
  for (const [moduleName, moduleSignals] of Object.entries(signals)) {
    for (const [signalName, signalDef] of Object.entries(moduleSignals)) {
      const def = signalDef as { id: string; schema: z.ZodType; type: 'sync' | 'async'; description?: string };
      signalSchemaRegistry.set(def.id, def.schema);
      signalMetaRegistry.set(def.id, {
        type: def.type,
        description: def.description,
        module: moduleName,
        name: signalName,
      });
    }
  }
}

// 执行注册
registerSignals();

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取 Signal 的 Zod Schema
 *
 * @param signalId - Signal ID（如 'article.beforeCreate'）
 * @returns Zod Schema 或 undefined
 */
export function getSignalSchema(signalId: string): z.ZodType | undefined {
  return signalSchemaRegistry.get(signalId);
}

/**
 * 获取 Signal 元数据
 *
 * @param signalId - Signal ID
 */
export function getSignalMeta(signalId: string) {
  return signalMetaRegistry.get(signalId);
}

/**
 * 检查 Signal 是否已定义
 *
 * @param signalId - Signal ID
 */
export function isSignalDefined(signalId: string): boolean {
  return signalSchemaRegistry.has(signalId);
}

/**
 * 获取所有已注册的 Signal ID
 */
export function getAllSignalIds(): string[] {
  return Array.from(signalSchemaRegistry.keys());
}

/**
 * 按模块获取 Signal ID
 *
 * @param moduleName - 模块名（如 'article', 'user'）
 */
export function getSignalIdsByModule(moduleName: string): string[] {
  return Array.from(signalMetaRegistry.entries())
    .filter(([, meta]) => meta.module === moduleName)
    .map(([id]) => id);
}

// ============================================================
// 类型导出（方便外部使用）
// ============================================================

/** 所有 Signal 定义的类型 */
export type Signals = typeof signals;

/** 获取某个模块的所有 Signal */
export type ModuleSignals<M extends keyof Signals> = Signals[M];

/** 获取某个具体 Signal 的数据类型 */
export type SignalDataType<M extends keyof Signals, S extends keyof Signals[M]> = Signals[M][S] extends {
  schema: z.ZodType<infer T>;
}
  ? T
  : never;
