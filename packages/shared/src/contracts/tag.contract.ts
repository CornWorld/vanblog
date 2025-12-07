import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import {
  Tag,
  TagReq,
  TagPatch,
  ArticleList,
  PaginationQuery,
  DeleteResponse,
} from '../runtime/schema.js';

// Extended schema with article count
export const TagWithCount = Tag.extend({
  articleCount: z.number().default(0),
});

export const TagListResponse = z.object({
  items: z.array(TagWithCount),
  total: z.number(),
});

// Tag statistics response
export const TagStatistics = z.object({
  totalTags: z.number(),
  totalArticles: z.number(),
  avgArticlesPerTag: z.number(),
  topTags: z.array(TagWithCount),
});

// Tag with categories association
export const TagWithCategories = Tag.extend({
  categories: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      articleCount: z.number(),
    }),
  ),
});

export const createTagContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getTags: {
      method: 'GET',
      path: '/v2/tags',
      responses: { 200: TagListResponse },
      summary: 'Get all tags',
    },
    getTagById: {
      method: 'GET',
      path: '/v2/tags/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: Tag },
      summary: 'Get tag by ID',
    },
    createTag: {
      method: 'POST',
      path: '/v2/tags',
      body: TagReq,
      responses: { 201: Tag },
      summary: 'Create tag',
    },
    updateTag: {
      method: 'PUT',
      path: '/v2/tags/:id',
      pathParams: z.object({ id: z.string() }),
      body: TagPatch,
      responses: { 200: Tag },
      summary: 'Update tag',
    },
    deleteTag: {
      method: 'DELETE',
      path: '/v2/tags/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: DeleteResponse },
      summary: 'Delete tag',
    },
    getStatistics: {
      method: 'GET',
      path: '/v2/tags/statistics/overall',
      responses: { 200: TagStatistics },
      summary: 'Get tag statistics',
    },
    getTagsWithCategories: {
      method: 'GET',
      path: '/v2/tags/associations/categories',
      responses: { 200: z.array(TagWithCategories) },
      summary: 'Get tags with categories',
    },
    getArticlesByTagName: {
      method: 'GET',
      path: '/v2/tags/name/:name/articles',
      pathParams: z.object({ name: z.string() }),
      query: PaginationQuery,
      responses: { 200: ArticleList },
      summary: 'Get articles by tag name',
    },
    getArticlesByTagId: {
      method: 'GET',
      path: '/v2/tags/:id/articles',
      pathParams: z.object({ id: z.string() }),
      query: PaginationQuery,
      responses: { 200: ArticleList },
      summary: 'Get articles by tag ID',
    },
  });
