/**
 * @file signals/definitions/rss.signals.ts
 *
 * RSS 模块 Signal 定义
 */

import { z } from 'zod';
import { $Article } from '../../runtime/schema.js';
import { defineSync, defineAsync } from '../types.js';

/**
 * RSS 模块 Signal 定义
 */
export const rssSignals = {
  /**
   * RSS 生成前
   *
   * - 类型: async（副作用）
   * - 数据: { articles: $Article[] }
   */
  beforeGenerate: defineAsync(
    'rss.beforeGenerate',
    z.object({
      articles: z.array($Article),
    }),
    'RSS 生成前',
  ),

  /**
   * RSS Feed 转换
   *
   * - 类型: sync（可修改数据）
   * - 数据: RSS Feed 配置
   * - 用途: 允许插件修改 RSS 内容
   */
  transformFeed: defineSync(
    'rss.transformFeed',
    z.object({
      title: z.string(),
      description: z.string().optional(),
      link: z.string(),
      items: z.array(
        z.object({
          title: z.string(),
          link: z.string(),
          description: z.string().optional(),
          pubDate: z.string().optional(),
          guid: z.string().optional(),
        }),
      ),
    }),
    'RSS Feed 转换，可修改 RSS 内容',
  ),

  /**
   * RSS 生成后
   *
   * - 类型: async（副作用）
   * - 数据: { files: string[] } - 生成的文件路径
   */
  afterGenerate: defineAsync(
    'rss.afterGenerate',
    z.object({
      files: z.array(z.string()),
    }),
    'RSS 生成后，用于 CDN 推送等',
  ),
} as const;
