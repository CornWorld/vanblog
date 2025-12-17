/**
 * @file signals/definitions/user.signals.ts
 *
 * 用户模块 Signal 定义
 */

import { z } from 'zod';
import { $User, $UserIns, $UserUpd } from '../../runtime/schema.js';
import { defineSync, defineAsync } from '../types.js';

/**
 * 用户模块 Signal 定义
 */
export const userSignals = {
  /**
   * 用户创建前
   *
   * - 类型: sync（可修改数据）
   * - 数据: $UserIns
   */
  beforeCreate: defineSync('user.beforeCreate', $UserIns, '用户创建前，可修改用户数据'),

  /**
   * 用户创建后
   *
   * - 类型: async（副作用）
   * - 数据: $User（已创建的用户，含 id，不含 password）
   */
  afterCreate: defineAsync('user.afterCreate', $User.omit({ password: true }), '用户创建后'),

  /**
   * 用户更新前
   *
   * - 类型: sync（可修改数据）
   * - 数据: $UserUpd
   */
  beforeUpdate: defineSync('user.beforeUpdate', $UserUpd, '用户更新前，可修改更新数据'),

  /**
   * 用户更新后
   *
   * - 类型: async（副作用）
   * - 数据: $User（更新后的用户，不含 password）
   */
  afterUpdate: defineAsync('user.afterUpdate', $User.omit({ password: true }), '用户更新后'),

  /**
   * 用户删除前
   *
   * - 类型: async（副作用）
   * - 数据: { id: number }
   */
  beforeDelete: defineAsync(
    'user.beforeDelete',
    z.object({ id: z.number() }),
    '用户删除前，用于清理关联数据',
  ),

  /**
   * 用户删除后
   *
   * - 类型: async（副作用）
   * - 数据: { id: number }
   */
  afterDelete: defineAsync('user.afterDelete', z.object({ id: z.number() }), '用户删除后'),

  /**
   * 密码修改后
   *
   * - 类型: async（副作用）
   * - 数据: { userId: number, username: string }
   * - 用途: 可用于强制登出、发送通知等
   */
  afterPasswordChange: defineAsync(
    'user.afterPasswordChange',
    z.object({
      userId: z.number(),
      username: z.string(),
    }),
    '密码修改后，用于安全审计/通知',
  ),

  /**
   * 用户登录后
   *
   * - 类型: async（副作用）
   * - 数据: { userId: number, username: string, ip: string }
   */
  afterLogin: defineAsync(
    'user.afterLogin',
    z.object({
      userId: z.number(),
      username: z.string(),
      ip: z.string().optional(),
    }),
    '用户登录后，用于登录日志/安全检测',
  ),
} as const;
