/**
 * @file signals/definitions/bootstrap.signals.ts
 *
 * Bootstrap（前端初始化数据）模块 Signal 定义
 */

import { z } from 'zod';
import { defineSync, defineAsync } from '../types.js';

/**
 * Bootstrap 模块 Signal 定义
 *
 * Bootstrap 是前端初始化时获取的站点配置和元数据
 */
export const bootstrapSignals = {
  /**
   * Bootstrap 数据准备前
   *
   * - 类型: async（副作用）
   * - 数据: { data: Record<string, unknown> }
   */
  beforeGenerate: defineAsync(
    'bootstrap.beforeGenerate',
    z.object({
      data: z.record(z.string(), z.unknown()),
    }),
    'Bootstrap 数据准备前',
  ),

  /**
   * Bootstrap 响应转换
   *
   * - 类型: sync（可修改数据）
   * - 数据: Bootstrap 响应对象
   * - 用途: 允许插件注入自定义配置到前端
   */
  transformResponse: defineSync(
    'bootstrap.transformResponse',
    z.object({
      response: z.record(z.string(), z.unknown()),
    }),
    'Bootstrap 响应转换，可注入自定义配置',
  ),

  /**
   * Bootstrap 生成后
   *
   * - 类型: async（副作用）
   * - 数据: { response: Record<string, unknown> }
   */
  afterGenerate: defineAsync(
    'bootstrap.afterGenerate',
    z.object({
      response: z.record(z.string(), z.unknown()),
    }),
    'Bootstrap 生成后',
  ),
} as const;
