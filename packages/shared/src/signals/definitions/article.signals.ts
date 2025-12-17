/**
 * @file signals/definitions/article.signals.ts
 *
 * 文章模块 Signal 定义
 */

import { z } from 'zod';
import { $Article, $ArticleIns, $ArticleUpd } from '../../runtime/schema.js';
import { defineSync, defineAsync } from '../types.js';

/**
 * 文章模块 Signal 定义
 *
 * @example
 * ```typescript
 * import { signals } from '@vanblog/shared/signals';
 *
 * // 连接 beforeCreate（可修改数据）
 * signalBus.connect(signals.article.beforeCreate, (article) => ({
 *   ...article,
 *   title: article.title + '喵',
 * }));
 *
 * // 订阅 afterCreate（副作用）
 * signalBus.subscribe(signals.article.afterCreate, (article) => {
 *   console.log(`Created: ${article.id} - ${article.title}`);
 * });
 * ```
 */
export const articleSignals = {
  /**
   * 文章创建前
   *
   * - 类型: sync（可修改数据）
   * - 数据: $ArticleIns（待插入的文章数据）
   * - 触发位置: ArticleService.create()
   */
  beforeCreate: defineSync('article.beforeCreate', $ArticleIns, '文章创建前，可修改文章数据'),

  /**
   * 文章创建后
   *
   * - 类型: async（副作用）
   * - 数据: $Article（已创建的文章，含 id）
   * - 触发位置: ArticleService.create()
   */
  afterCreate: defineAsync('article.afterCreate', $Article, '文章创建后，用于通知/日志等副作用'),

  /**
   * 文章更新前
   *
   * - 类型: sync（可修改数据）
   * - 数据: $ArticleUpd（待更新的部分字段）
   * - 触发位置: ArticleService.update()
   */
  beforeUpdate: defineSync('article.beforeUpdate', $ArticleUpd, '文章更新前，可修改更新数据'),

  /**
   * 文章更新后
   *
   * - 类型: async（副作用）
   * - 数据: $Article（更新后的完整文章）
   * - 触发位置: ArticleService.update()
   */
  afterUpdate: defineAsync('article.afterUpdate', $Article, '文章更新后，用于缓存刷新等副作用'),

  /**
   * 文章删除前
   *
   * - 类型: async（副作用，不可阻止删除）
   * - 数据: { id: number }
   * - 触发位置: ArticleService.remove()
   */
  beforeDelete: defineAsync(
    'article.beforeDelete',
    z.object({ id: z.number() }),
    '文章删除前，用于清理关联资源',
  ),

  /**
   * 文章删除后
   *
   * - 类型: async（副作用）
   * - 数据: { id: number }
   * - 触发位置: ArticleService.remove()
   */
  afterDelete: defineAsync(
    'article.afterDelete',
    z.object({ id: z.number() }),
    '文章删除后，用于索引更新等副作用',
  ),
} as const;
