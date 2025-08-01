import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { commonSchemas } from '../../../shared/zod';

// 基础文章 Schema
export const ArticleSchema = z.object({
  id: commonSchemas.id,
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  isPublished: z.boolean().default(false),
  isTop: z.boolean().default(false),
  password: z.string().optional().nullable(),
  allowComment: z.boolean().default(true),
  copyright: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  publishedAt: z.date().optional(),
  viewCount: z.number().default(0),
  likeCount: z.number().default(0),
  commentCount: z.number().default(0),
  wordCount: z.number().default(0),
  readTime: z.number().default(0),
});

// 创建文章 Schema
export const CreateArticleSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
  summary: z.string().optional(),
  cover: z.string().optional(),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  isPublished: z.boolean().default(false),
  isTop: z.boolean().default(false),
  password: z.string().optional().nullable(),
  allowComment: z.boolean().default(true),
  copyright: z.string().optional(),
  publishedAt: z.date().optional(),
  pathname: z.string().optional(),
  category: z.string().optional(),
  author: z.string().optional(),
  top: z.number().optional(),
  hidden: z.boolean().optional(),
  private: z.boolean().optional(),
});

// 更新文章 Schema
export const UpdateArticleSchema = CreateArticleSchema.partial();

// 文章查询 Schema
export const ArticleQuerySchema = z.object({
  page: commonSchemas.page,
  pageSize: commonSchemas.pageSize,
  keyword: z.string().optional(),
  tag: z.string().optional(),
  category: z.string().optional(),
  isPublished: z.boolean().optional(),
  isTop: z.boolean().optional(),
  includeHidden: z.boolean().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'publishedAt', 'viewCount', 'likeCount'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 文章列表响应 Schema
export const ArticleListResponseSchema = z.object({
  items: z.array(ArticleSchema),
  total: z.number(),
  page: commonSchemas.page,
  pageSize: commonSchemas.pageSize,
  totalPages: z.number(),
});

// 文章搜索 Schema
export const ArticleSearchSchema = z.object({
  keyword: z.string().min(1, '搜索关键词不能为空'),
  page: commonSchemas.page,
  pageSize: commonSchemas.pageSize,
  query: z.string().optional(),
  titleOnly: z.boolean().optional(),
  contentOnly: z.boolean().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  includeHidden: z.boolean().optional(),
  includePrivate: z.boolean().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.string().optional(),
});

// 文章搜索结果 Schema
export const ArticleSearchResultSchema = z.object({
  id: z.number(),
  title: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  tags: z.array(z.string()),
  categories: z.array(z.string()),
  publishedAt: z.date().optional(),
  highlight: z
    .object({
      title: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
});

// 文章搜索响应 Schema
export const ArticleSearchResponseSchema = z.object({
  items: z.array(ArticleSearchResultSchema),
  total: z.number(),
  page: commonSchemas.page,
  pageSize: commonSchemas.pageSize,
  totalPages: z.number(),
});

export class CreateArticleDto extends createZodDto(CreateArticleSchema) {}
export class UpdateArticleDto extends createZodDto(UpdateArticleSchema) {}
export class ArticleDto extends createZodDto(ArticleSchema) {}
export class ArticleQueryDto extends createZodDto(ArticleQuerySchema) {}
export class ArticleListResponseDto extends createZodDto(ArticleListResponseSchema) {}
export class ArticleSearchDto extends createZodDto(ArticleSearchSchema) {}
export class ArticleSearchResultDto extends createZodDto(ArticleSearchResultSchema) {}
export class ArticleSearchResponseDto extends createZodDto(ArticleSearchResponseSchema) {}
