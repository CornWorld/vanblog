import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { commonSchemas } from '../../../shared/zod';

// 创建草稿 Schema
export const CreateDraftSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
  summary: z.string().optional(),
  cover: z.string().optional(),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
});

// 更新草稿 Schema
export const UpdateDraftSchema = CreateDraftSchema.partial();

// 基础草稿 Schema
export const DraftSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.number(),
  wordCount: z.number().default(0),
  readTime: z.number().default(0),
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

// 草稿版本 Schema
export const DraftVersionSchema = z.object({
  id: z.number(),
  draftId: z.number(),
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  createdAt: z.date(),
  version: z.number(),
  comment: z.string().optional(),
});

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
