import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { TagSchema, CreateTagSchema, UpdateTagSchema, ArticleSchema } from '../schemas.js';

// Response schemas
export const TagResponseSchema = TagSchema;
export type TagResponse = z.infer<typeof TagResponseSchema>;

export const TagWithCountSchema = TagSchema.extend({
  articleCount: z.number().default(0),
});

export const TagListResponseSchema = z.object({
  items: z.array(TagWithCountSchema),
  total: z.number(),
});

export const ArticleListResponseSchema = z.object({
  items: z.array(ArticleSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const ArticleQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(10),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createTagContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getTags: {
      method: 'GET',
      path: '/v2/tags',
      responses: { 200: TagListResponseSchema },
      summary: 'Get all tags',
    },
    getTagById: {
      method: 'GET',
      path: '/v2/tags/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: TagResponseSchema },
      summary: 'Get tag by ID',
    },
    createTag: {
      method: 'POST',
      path: '/v2/tags',
      body: CreateTagSchema,
      responses: { 201: TagResponseSchema },
      summary: 'Create tag',
    },
    updateTag: {
      method: 'PUT',
      path: '/v2/tags/:id',
      pathParams: z.object({ id: z.string() }),
      body: UpdateTagSchema,
      responses: { 200: TagResponseSchema },
      summary: 'Update tag',
    },
    deleteTag: {
      method: 'DELETE',
      path: '/v2/tags/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.object({ success: z.boolean() }) },
      summary: 'Delete tag',
    },
    getStatistics: {
      method: 'GET',
      path: '/v2/tags/statistics/overall',
      responses: { 200: z.any() },
      summary: 'Get tag statistics',
    },
    getTagsWithCategories: {
      method: 'GET',
      path: '/v2/tags/associations/categories',
      responses: { 200: z.any() },
      summary: 'Get tags with categories',
    },
    getArticlesByTagName: {
      method: 'GET',
      path: '/v2/tags/name/:name/articles',
      pathParams: z.object({ name: z.string() }),
      query: ArticleQuerySchema,
      responses: { 200: ArticleListResponseSchema },
      summary: 'Get articles by tag name',
    },
    getArticlesByTagId: {
      method: 'GET',
      path: '/v2/tags/:id/articles',
      pathParams: z.object({ id: z.string() }),
      query: ArticleQuerySchema,
      responses: { 200: ArticleListResponseSchema },
      summary: 'Get articles by tag ID',
    },
  });
