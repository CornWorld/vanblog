/**
 * @file signals/definitions/webhook.signals.ts
 *
 * Webhook 模块 Signal 定义
 */

import { z } from 'zod';
import { $Webhook } from '../../runtime/schema.js';
import { defineSync, defineAsync } from '../types.js';

/**
 * Webhook 模块 Signal 定义
 */
export const webhookSignals = {
  /**
   * Webhook 触发前
   *
   * - 类型: sync（可修改数据）
   * - 数据: Webhook 请求配置
   * - 用途: 允许插件修改请求头、payload 等
   */
  beforeTrigger: defineSync(
    'webhook.beforeTrigger',
    z.object({
      webhook: $Webhook,
      event: z.string(),
      payload: z.record(z.string(), z.unknown()),
      headers: z.record(z.string(), z.string()).optional(),
    }),
    'Webhook 触发前，可修改请求配置',
  ),

  /**
   * Webhook 触发后
   *
   * - 类型: async（副作用）
   * - 数据: 触发结果
   */
  afterTrigger: defineAsync(
    'webhook.afterTrigger',
    z.object({
      webhookId: z.number(),
      event: z.string(),
      success: z.boolean(),
      statusCode: z.number().optional(),
      error: z.string().optional(),
      duration: z.number().optional(),
    }),
    'Webhook 触发后，用于日志记录',
  ),
} as const;
