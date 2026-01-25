/**
 * @file signals/definitions/setting.signals.ts
 *
 * 设置模块 Signal 定义
 */

import { z } from 'zod';
import { defineAsync } from '../types.js';

/**
 * 设置模块 Signal 定义
 */
export const settingSignals = {
  /**
   * 设置更新后
   *
   * - 类型: async（副作用）
   * - 数据: { key: string, value: unknown, oldValue?: unknown }
   * - 用途: 缓存刷新、配置重载等
   */
  afterUpdate: defineAsync(
    'setting.afterUpdate',
    z.object({
      key: z.string(),
      value: z.unknown(),
      oldValue: z.unknown().optional(),
    }),
    '设置更新后，用于缓存刷新/配置重载',
  ),

  /**
   * 站点信息更新后
   *
   * - 类型: async（副作用）
   * - 数据: 站点信息对象
   */
  afterSiteInfoUpdate: defineAsync(
    'setting.afterSiteInfoUpdate',
    z.object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      author: z.string().optional(),
      logo: z.string().optional(),
      favicon: z.string().optional(),
    }),
    '站点信息更新后，用于 RSS 重建等',
  ),
} as const;
