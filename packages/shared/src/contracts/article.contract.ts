import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  Article,
  ArticleReq,
  ArticlePatch,
  ArticleList,
  ArticleQuery,
  SearchQuery,
  DeleteResponse,
  PasswordVerifyReq,
  PasswordVerifyResp,
} from '../runtime/schema.js';

export const createArticleContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    findAll: {
      method: 'GET',
      path: '/v2/articles',
      query: ArticleQuery,
      responses: { 200: ArticleList },
    },
    search: {
      method: 'GET',
      path: '/v2/articles/search',
      query: SearchQuery,
      responses: { 200: ArticleList },
    },
    exportAll: {
      method: 'GET',
      path: '/v2/articles/export',
      query: z.object({}).optional(),
      responses: { 200: z.array(Article) },
    },
    importBulk: {
      method: 'POST',
      path: '/v2/articles/import',
      body: z.array(ArticleReq),
      responses: { 201: z.object({ count: z.number() }) },
    },
    findByCategory: {
      method: 'GET',
      path: '/v2/articles/category/:name',
      pathParams: z.object({ name: z.string() }),
      query: ArticleQuery,
      responses: { 200: ArticleList },
    },
    groupedByCategory: {
      method: 'GET',
      path: '/v2/articles/grouped-by-category',
      query: z.object({}).optional(),
      responses: { 200: z.record(z.string(), z.array(Article)) },
    },
    groupedByTag: {
      method: 'GET',
      path: '/v2/articles/grouped-by-tag',
      query: z.object({}).optional(),
      responses: { 200: z.record(z.string(), z.array(Article)) },
    },
    findOne: {
      method: 'GET',
      path: '/v2/articles/:id',
      pathParams: z.object({ id: z.string() }),
      query: z.object({}).optional(),
      responses: {
        200: Article,
        404: z.object({ message: z.string() }),
      },
    },
    incrementView: {
      method: 'POST',
      path: '/v2/articles/:id/view',
      pathParams: z.object({ id: z.string() }),
      body: z.object({}),
      responses: { 200: z.object({ viewer: z.number() }) },
    },
    incrementViewByPathname: {
      method: 'POST',
      path: '/v2/articles/pathname/:pathname/view',
      pathParams: z.object({ pathname: z.string() }),
      body: z.object({}),
      responses: { 200: z.object({ viewer: z.number() }) },
    },
    create: {
      method: 'POST',
      path: '/v2/articles',
      body: ArticleReq,
      responses: { 201: Article },
    },
    update: {
      method: 'PUT',
      path: '/v2/articles/:id',
      pathParams: z.object({ id: z.string() }),
      body: ArticlePatch,
      responses: {
        200: Article,
        404: z.object({ message: z.string() }),
      },
    },
    remove: {
      method: 'DELETE',
      path: '/v2/articles/:id',
      pathParams: z.object({ id: z.string() }),
      body: z.object({}).optional(),
      responses: { 200: DeleteResponse },
    },
    verifyPassword: {
      method: 'POST',
      path: '/v2/articles/:id/verify-password',
      pathParams: z.object({ id: z.string() }),
      body: PasswordVerifyReq,
      responses: { 200: PasswordVerifyResp },
    },
    verifyPasswordByPathname: {
      method: 'POST',
      path: '/v2/articles/by-path/:pathname/verify-password',
      pathParams: z.object({ pathname: z.string() }),
      body: PasswordVerifyReq,
      responses: { 200: PasswordVerifyResp },
    },
    findOneByPathname: {
      method: 'GET',
      path: '/v2/articles/by-path/:pathname',
      pathParams: z.object({ pathname: z.string() }),
      query: z.object({}).optional(),
      responses: {
        200: Article,
        404: z.object({ message: z.string() }),
      },
    },
  });
