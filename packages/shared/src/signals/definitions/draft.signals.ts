/**
 * @file signals/definitions/draft.signals.ts
 *
 * 草稿模块 Signal 定义
 */

import { z } from 'zod';
import { $Draft, $DraftIns, $DraftUpd } from '../../runtime/schema.js';
import { defineSync, defineAsync } from '../types.js';

/**
 * 草稿模块 Signal 定义
 */
export const draftSignals = {
  /**
   * 草稿创建前
   */
  beforeCreate: defineSync('draft.beforeCreate', $DraftIns, '草稿创建前，可修改草稿数据'),

  /**
   * 草稿创建后
   */
  afterCreate: defineAsync('draft.afterCreate', $Draft, '草稿创建后'),

  /**
   * 草稿更新前
   */
  beforeUpdate: defineSync('draft.beforeUpdate', $DraftUpd, '草稿更新前，可修改更新数据'),

  /**
   * 草稿更新后
   */
  afterUpdate: defineAsync('draft.afterUpdate', $Draft, '草稿更新后'),

  /**
   * 草稿删除前
   */
  beforeDelete: defineAsync(
    'draft.beforeDelete',
    z.object({ id: z.number() }),
    '草稿删除前，用于清理版本历史',
  ),

  /**
   * 草稿删除后
   */
  afterDelete: defineAsync('draft.afterDelete', z.object({ id: z.number() }), '草稿删除后'),

  /**
   * 草稿发布后
   *
   * - 类型: async（副作用）
   * - 数据: { draftId: number, articleId: number }
   * - 触发位置: 草稿发布为文章时
   */
  afterPublish: defineAsync(
    'draft.afterPublish',
    z.object({
      draftId: z.number(),
      articleId: z.number(),
    }),
    '草稿发布为文章后',
  ),
} as const;
