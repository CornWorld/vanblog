import { c } from '@vanblog/shared';
import {
  selectArticleSchema,
  insertArticleSchema,
  updateArticleSchema,
} from '@vanblog/shared/drizzle';
import { z } from 'zod';

// 基础文章 Schema - 使用 drizzle-zod 生成的 schema
export const ArticleSchema = selectArticleSchema;

// 创建文章 Schema - 使用 drizzle-zod 生成的 schema，并添加默认值支持
export const CreateArticleSchema = insertArticleSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    viewer: true,
  })
  .partial({
    // 允许以下字段为可选，服务层将提供默认值
    content: true,
    tags: true,
    author: true,
    // 其他字段保持原有行为
  });

// 更新文章 Schema - 使用 drizzle-zod 生成的 schema
export const UpdateArticleSchema = updateArticleSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 文章查询 Schema
export const ArticleQuerySchema = z.object({
  page: c.page,
  pageSize: c.pageSize,
  keyword: z.string().optional(),
  tag: z.string().optional(),
  category: z.string().optional(),
  isPublished: z.boolean().optional(),
  isTop: z.boolean().optional(),
  includeHidden: z.boolean().default(false).optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'publishedAt', 'viewCount', 'likeCount'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 文章列表响应 Schema
export const ArticleListResponseSchema = z.object({
  items: z.array(ArticleSchema),
  total: z.number(),
  page: c.page,
  pageSize: c.pageSize,
  totalPages: z.number(),
});

// 文章搜索 Schema
// Accepts both `keyword` and `link` (contract alias used by admin frontend)
export const ArticleSearchSchema = z
  .object({
    keyword: z.string().min(1, '搜索关键词不能为空').optional(),
    link: z.string().optional(),
    page: c.page,
    pageSize: c.pageSize,
    query: z.string().optional(),
    titleOnly: z.boolean().optional(),
    contentOnly: z.boolean().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    includeHidden: z.boolean().optional(),
    includePrivate: z.boolean().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    // Map `link` to `keyword` for backward compatibility with admin contract
    keyword: data.keyword ?? data.link ?? '',
  }))
  .refine((data) => data.keyword.length > 0, {
    message: '搜索关键词不能为空',
    path: ['keyword'],
  });

// 文章搜索结果 Schema
export const ArticleSearchResultSchema = z.object({
  id: z.number(),
  title: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  tags: z.array(z.string()),
  categories: z.array(z.string()),
  publishedAt: z.string().optional(),
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
  page: c.page,
  pageSize: c.pageSize,
  totalPages: z.number(),
});

export type CreateArticleDto = z.infer<typeof CreateArticleSchema>;
export type UpdateArticleDto = z.infer<typeof UpdateArticleSchema>;
export type ArticleDto = z.infer<typeof ArticleSchema>;
export type ArticleQueryDto = z.infer<typeof ArticleQuerySchema>;
export type ArticleListResponseDto = z.infer<typeof ArticleListResponseSchema>;
export type ArticleSearchDto = z.infer<typeof ArticleSearchSchema>;
export type ArticleSearchResultDto = z.infer<typeof ArticleSearchResultSchema>;
export type ArticleSearchResponseDto = z.infer<typeof ArticleSearchResponseSchema>;
