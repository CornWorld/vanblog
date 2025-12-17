/**
 * @file signals/definitions/category.signals.ts
 *
 * 分类模块 Signal 定义
 */

import { z } from 'zod';
import { $Category, $CategoryIns, $CategoryUpd } from '../../runtime/schema.js';
import { defineSync, defineAsync } from '../types.js';

/**
 * 分类模块 Signal 定义
 */
export const categorySignals = {
  /**
   * 分类创建前
   */
  beforeCreate: defineSync('category.beforeCreate', $CategoryIns, '分类创建前，可修改分类数据'),

  /**
   * 分类创建后
   */
  afterCreate: defineAsync('category.afterCreate', $Category, '分类创建后'),

  /**
   * 分类更新前
   */
  beforeUpdate: defineSync('category.beforeUpdate', $CategoryUpd, '分类更新前，可修改更新数据'),

  /**
   * 分类更新后
   */
  afterUpdate: defineAsync('category.afterUpdate', $Category, '分类更新后'),

  /**
   * 分类删除前
   */
  beforeDelete: defineAsync(
    'category.beforeDelete',
    z.object({ id: z.number() }),
    '分类删除前，可用于检查关联文章',
  ),

  /**
   * 分类删除后
   */
  afterDelete: defineAsync('category.afterDelete', z.object({ id: z.number() }), '分类删除后'),
} as const;
