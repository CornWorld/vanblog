import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  selectDraftSchema,
  insertDraftSchema,
  updateDraftSchema,
  selectDraftVersionSchema,
} from '../../../database';
import { commonSchemas } from '../../../shared/zod';

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
  page: commonSchemas.page,
  pageSize: commonSchemas.pageSize,
  keyword: z.string().optional(),
  tag: z.string().optional(),
  category: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 草稿列表响应 Schema
export const DraftListResponseSchema = z.object({
  items: z.array(DraftSchema),
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
  publishedAt: z.date().optional(),
});

// 草稿版本 Schema - 使用 drizzle-zod 生成的 schema
export const DraftVersionSchema = selectDraftVersionSchema;

// 草稿版本列表响应 Schema
export const DraftVersionListResponseSchema = z.object({
  items: z.array(DraftVersionSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export class CreateDraftDto extends createZodDto(CreateDraftSchema) {}
export class UpdateDraftDto extends createZodDto(UpdateDraftSchema) {}
export class DraftDto extends createZodDto(DraftSchema) {}
export class DraftListResponseDto extends createZodDto(DraftListResponseSchema) {}
export class DraftQueryDto extends createZodDto(DraftQuerySchema) {}
export class PublishDraftDto extends createZodDto(PublishDraftSchema) {}
export class DraftVersionDto extends createZodDto(DraftVersionSchema) {}
export class DraftVersionListResponseDto extends createZodDto(DraftVersionListResponseSchema) {}
