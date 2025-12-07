import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createArticleContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    findAll: {
      method: 'GET',
      path: '/v2/articles',
      query: z.any().optional(),
      responses: { 200: z.any() },
    },
    search: {
      method: 'GET',
      path: '/v2/articles/search',
      query: z.any().optional(),
      responses: { 200: z.any() },
    },
    exportAll: {
      method: 'GET',
      path: '/v2/articles/export',
      query: z.object({}).optional(),
      responses: { 200: z.any() },
    },
    importBulk: {
      method: 'POST',
      path: '/v2/articles/import',
      body: z.any(),
      responses: { 201: z.undefined() },
    },
    findByCategory: {
      method: 'GET',
      path: '/v2/articles/category/:name',
      pathParams: z.object({ name: z.string() }),
      query: z.any().optional(),
      responses: { 200: z.any() },
    },
    groupedByCategory: {
      method: 'GET',
      path: '/v2/articles/grouped-by-category',
      query: z.object({}).optional(),
      responses: { 200: z.record(z.string(), z.any()) },
    },
    groupedByTag: {
      method: 'GET',
      path: '/v2/articles/grouped-by-tag',
      query: z.object({}).optional(),
      responses: { 200: z.record(z.string(), z.any()) },
    },
    findOne: {
      method: 'GET',
      path: '/v2/articles/:id',
      pathParams: z.object({ id: z.string() }),
      query: z.object({}).optional(),
      responses: { 200: z.any() },
    },
    incrementView: {
      method: 'POST',
      path: '/v2/articles/:id/view',
      pathParams: z.object({ id: z.string() }),
      body: z.object({}),
      responses: { 200: z.object({ success: z.boolean() }) },
    },
    incrementViewByPathname: {
      method: 'POST',
      path: '/v2/articles/pathname/:pathname/view',
      pathParams: z.object({ pathname: z.string() }),
      body: z.object({}),
      responses: { 200: z.object({ success: z.boolean() }) },
    },
    create: {
      method: 'POST',
      path: '/v2/articles',
      body: z.any(),
      responses: { 201: z.any() },
    },
    update: {
      method: 'PUT',
      path: '/v2/articles/:id',
      pathParams: z.object({ id: z.string() }),
      body: z.any(),
      responses: { 200: z.any() },
    },
    remove: {
      method: 'DELETE',
      path: '/v2/articles/:id',
      pathParams: z.object({ id: z.string() }),
      body: z.object({}).optional(),
      responses: { 200: z.object({ success: z.boolean() }) },
    },
    verifyPassword: {
      method: 'POST',
      path: '/v2/articles/:id/verify-password',
      pathParams: z.object({ id: z.string() }),
      body: z.any(),
      responses: { 200: z.any() },
    },
    verifyPasswordByPathname: {
      method: 'POST',
      path: '/v2/articles/by-path/:pathname/verify-password',
      pathParams: z.object({ pathname: z.string() }),
      body: z.any(),
      responses: { 200: z.any() },
    },
    findOneByPathname: {
      method: 'GET',
      path: '/v2/articles/by-path/:pathname',
      pathParams: z.object({ pathname: z.string() }),
      query: z.object({}).optional(),
      responses: { 200: z.any() },
    },
  });
