/**
 * @file signals/definitions/media.signals.ts
 *
 * 媒体/文件模块 Signal 定义
 */

import { z } from 'zod';
import { $StaticFile } from '../../runtime/schema.js';
import { defineSync, defineAsync } from '../types.js';

/**
 * 上传文件输入 Schema
 */
const UploadInput = z.object({
  file: z.object({
    originalname: z.string(),
    mimetype: z.string(),
    size: z.number(),
  }),
  customFilename: z.string().optional(),
});

/**
 * 媒体模块 Signal 定义
 */
export const mediaSignals = {
  /**
   * 文件上传前
   *
   * - 类型: sync（可修改数据）
   * - 数据: { file: {...}, customFilename?: string }
   * - 用途: 可修改文件名、校验文件类型等
   */
  beforeUpload: defineSync('media.beforeUpload', UploadInput, '文件上传前，可修改文件名/校验'),

  /**
   * 文件上传后
   *
   * - 类型: async（副作用）
   * - 数据: { file: $StaticFile }
   */
  afterUpload: defineAsync(
    'media.afterUpload',
    z.object({ file: $StaticFile }),
    '文件上传后，用于图片处理/CDN 推送',
  ),

  /**
   * 文件删除前
   *
   * - 类型: async（副作用）
   * - 数据: { file: $StaticFile }
   */
  beforeDelete: defineAsync(
    'media.beforeDelete',
    z.object({ file: $StaticFile }),
    '文件删除前，用于清理 CDN 缓存',
  ),

  /**
   * 文件删除后
   *
   * - 类型: async（副作用）
   * - 数据: { file: $StaticFile, success: boolean }
   */
  afterDelete: defineAsync(
    'media.afterDelete',
    z.object({
      file: $StaticFile,
      success: z.boolean(),
    }),
    '文件删除后',
  ),

  /**
   * 批量删除前
   *
   * - 类型: async（副作用）
   * - 数据: { files: $StaticFile[], ids: number[] }
   */
  beforeDeleteBatch: defineAsync(
    'media.beforeDeleteBatch',
    z.object({
      files: z.array($StaticFile),
      ids: z.array(z.number()),
    }),
    '批量删除前',
  ),

  /**
   * 批量删除后
   *
   * - 类型: async（副作用）
   * - 数据: { deletedCount: number, files: [...] }
   */
  afterDeleteBatch: defineAsync(
    'media.afterDeleteBatch',
    z.object({
      deletedCount: z.number(),
      files: z.array(
        z.object({
          id: z.number(),
          filename: z.string(),
        }),
      ),
    }),
    '批量删除后',
  ),
} as const;
