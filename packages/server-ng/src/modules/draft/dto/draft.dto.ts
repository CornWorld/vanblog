import { c } from '@vanblog/shared';
import {
  selectDraftSchema,
  insertDraftSchema,
  updateDraftSchema,
  selectDraftVersionSchema,
} from '@vanblog/shared/drizzle';
import { z } from 'zod';

// 基础草稿 Schema - 使用 drizzle-zod 生成的 schema
export const DraftSchema = selectDraftSchema;

// 创建草稿 Schema - 使用 drizzle-zod 生成的 schema
export const CreateDraftSchema = insertDraftSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
});

// 更新草稿 Schema - 使用 drizzle-zod 生成的 schema
export const UpdateDraftSchema = updateDraftSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 草稿查询 Schema
export const DraftQuerySchema = z.object({
  page: c.page,
  pageSize: c.pageSize,
  keyword: z.string().optional(),
  tag: z.string().optional(),
  category: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 草稿列表响应 Schema
export const DraftListResponseSchema = z.object({
  items: z.array(DraftSchema as unknown as z.ZodType),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

// 发布草稿 Schema
export const PublishDraftSchema = z.object({
  isPublished: z.boolean().default(true),
  isTop: z.boolean().default(false),
  password: z.string().optional().nullable(),
  allowComment: z.boolean().default(true),
  copyright: z.string().optional(),
  publishedAt: z.string().optional(),
});

// 草稿版本 Schema - 使用 drizzle-zod 生成的 schema
export const DraftVersionSchema = selectDraftVersionSchema;

// 草稿版本列表响应 Schema
export const DraftVersionListResponseSchema = z.object({
  items: z.array(DraftVersionSchema as unknown as z.ZodType),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export type CreateDraftDto = z.infer<typeof CreateDraftSchema>;
export type UpdateDraftDto = z.infer<typeof UpdateDraftSchema>;
export type DraftDto = z.infer<typeof DraftSchema>;
export type DraftListResponseDto = z.infer<typeof DraftListResponseSchema>;
export type DraftQueryDto = z.infer<typeof DraftQuerySchema>;
export type PublishDraftDto = z.infer<typeof PublishDraftSchema>;
export type DraftVersionDto = z.infer<typeof DraftVersionSchema>;
export type DraftVersionListResponseDto = z.infer<typeof DraftVersionListResponseSchema>;
