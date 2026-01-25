/**
 * @file signals/definitions/system.signals.ts
 *
 * 系统级 Signal 定义
 */

import { z } from 'zod';
import { defineAsync } from '../types.js';

/**
 * 系统级 Signal 定义
 *
 * 用于应用生命周期事件
 */
export const systemSignals = {
  /**
   * 应用启动完成
   *
   * - 类型: async（副作用）
   * - 触发时机: NestJS 应用启动完成后
   */
  afterBootstrap: defineAsync(
    'system.afterBootstrap',
    z.object({
      timestamp: z.number(),
      environment: z.string().optional(),
    }),
    '应用启动完成后',
  ),

  /**
   * 应用即将关闭
   *
   * - 类型: async（副作用）
   * - 触发时机: 收到 SIGTERM/SIGINT 信号
   * - 用途: 清理资源、保存状态
   */
  beforeShutdown: defineAsync(
    'system.beforeShutdown',
    z.object({
      signal: z.string().optional(),
    }),
    '应用关闭前，用于资源清理',
  ),

  /**
   * 定时任务触发
   *
   * - 类型: async（副作用）
   * - 用途: 供插件响应定时任务
   */
  onScheduledTask: defineAsync(
    'system.onScheduledTask',
    z.object({
      taskName: z.string(),
      timestamp: z.number(),
    }),
    '定时任务触发',
  ),
} as const;
