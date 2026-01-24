import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import {
  Category,
  CategoryReq,
  CategoryPatch,
  ArticleList,
  PaginationQuery,
  DeleteResponse,
} from '../runtime/schema.js';

// Extended schema with article count
export const CategoryWithCount = Category.extend({
  articleCount: z.number().default(0),
});

export const CategoryListResponse = z.object({
  items: z.array(CategoryWithCount),
  total: z.number(),
});

export const createCategoryContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getCategories: {
      method: 'GET',
      path: '/categories',
      query: z.object({ detail: z.string().optional() }).optional(),
      responses: { 200: CategoryListResponse },
      summary: 'Get all categories',
    },
    getCategoryById: {
      method: 'GET',
      path: '/categories/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: Category },
      summary: 'Get category by ID',
    },
    createCategory: {
      method: 'POST',
      path: '/categories',
      body: CategoryReq,
      responses: { 201: Category },
      summary: 'Create category',
    },
    updateCategory: {
      method: 'PUT',
      path: '/categories/:id',
      pathParams: z.object({ id: z.string() }),
      body: CategoryPatch,
      responses: { 200: Category },
      summary: 'Update category',
    },
    deleteCategory: {
      method: 'DELETE',
      path: '/categories/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: DeleteResponse },
      summary: 'Delete category',
    },
    getArticlesByCategory: {
      method: 'GET',
      path: '/categories/:id/articles',
      pathParams: z.object({ id: z.string() }),
      query: PaginationQuery,
      responses: { 200: ArticleList },
      summary: 'Get articles by category',
    },
    getArticlesByCategoryName: {
      method: 'GET',
      path: '/categories/name/:name/articles',
      pathParams: z.object({ name: z.string() }),
      query: PaginationQuery,
      responses: { 200: ArticleList },
      summary: 'Get articles by category name',
    },
  });
