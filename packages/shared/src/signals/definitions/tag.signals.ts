/**
 * @file signals/definitions/tag.signals.ts
 *
 * 标签模块 Signal 定义
 */

import { z } from 'zod';
import { $Tag, $TagIns, $TagUpd } from '../../runtime/schema.js';
import { defineSync, defineAsync } from '../types.js';

/**
 * 标签模块 Signal 定义
 */
export const tagSignals = {
  /**
   * 标签创建前
   */
  beforeCreate: defineSync('tag.beforeCreate', $TagIns, '标签创建前，可修改标签数据'),

  /**
   * 标签创建后
   */
  afterCreate: defineAsync('tag.afterCreate', $Tag, '标签创建后'),

  /**
   * 标签更新前
   */
  beforeUpdate: defineSync('tag.beforeUpdate', $TagUpd, '标签更新前，可修改更新数据'),

  /**
   * 标签更新后
   */
  afterUpdate: defineAsync('tag.afterUpdate', $Tag, '标签更新后'),

  /**
   * 标签删除前
   */
  beforeDelete: defineAsync('tag.beforeDelete', z.object({ id: z.number() }), '标签删除前'),

  /**
   * 标签删除后
   */
  afterDelete: defineAsync('tag.afterDelete', z.object({ id: z.number() }), '标签删除后'),
} as const;
