import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import {
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  ArticleSchema,
} from '../schemas.js';

// Response schemas
export const CategoryResponseSchema = CategorySchema;
export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;

export const CategoryWithCountSchema = CategorySchema.extend({
  articleCount: z.number().default(0),
});

export const CategoryListResponseSchema = z.object({
  items: z.array(CategoryWithCountSchema),
  total: z.number(),
});

export const ArticleResponseSchema = ArticleSchema;

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

export const createCategoryContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getCategories: {
      method: 'GET',
      path: '/v2/categories',
      query: z.object({ detail: z.string().optional() }).optional(),
      responses: { 200: CategoryListResponseSchema },
      summary: 'Get all categories',
    },
    getCategoryById: {
      method: 'GET',
      path: '/v2/categories/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: CategoryResponseSchema },
      summary: 'Get category by ID',
    },
    createCategory: {
      method: 'POST',
      path: '/v2/categories',
      body: CreateCategorySchema,
      responses: { 201: CategoryResponseSchema },
      summary: 'Create category',
    },
    updateCategory: {
      method: 'PUT',
      path: '/v2/categories/:id',
      pathParams: z.object({ id: z.string() }),
      body: UpdateCategorySchema,
      responses: { 200: CategoryResponseSchema },
      summary: 'Update category',
    },
    deleteCategory: {
      method: 'DELETE',
      path: '/v2/categories/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.object({ success: z.boolean() }) },
      summary: 'Delete category',
    },
    getArticlesByCategory: {
      method: 'GET',
      path: '/v2/categories/:id/articles',
      pathParams: z.object({ id: z.string() }),
      query: ArticleQuerySchema,
      responses: { 200: ArticleListResponseSchema },
      summary: 'Get articles by category',
    },
    getArticlesByCategoryName: {
      method: 'GET',
      path: '/v2/categories/name/:name/articles',
      pathParams: z.object({ name: z.string() }),
      query: ArticleQuerySchema,
      responses: { 200: ArticleListResponseSchema },
      summary: 'Get articles by category name',
    },
  });
