import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { dateStr } from '../date-codecs.js';
import { CreateDraftSchema, UpdateDraftSchema } from '../schemas.js';

export const DraftResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: dateStr,
  updatedAt: dateStr,
});
export type DraftResponse = z.infer<typeof DraftResponseSchema>;

export const DraftListResponseSchema = z.object({
  items: z.array(DraftResponseSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type DraftListResponse = z.infer<typeof DraftListResponseSchema>;

export const ArticleResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  pathname: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  top: z.number().optional(),
  hidden: z.boolean().optional(),
  private: z.boolean().optional(),
  password: z.string().optional(),
  viewer: z.number().optional(),
  createdAt: dateStr,
  updatedAt: dateStr,
});
export type ArticleResponse = z.infer<typeof ArticleResponseSchema>;

export const createDraftContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getDrafts: {
      method: 'GET',
      path: '/v2/drafts',
      query: z.object({
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional(),
        category: z.string().optional(),
        tag: z.string().optional(),
      }),
      responses: { 200: DraftListResponseSchema },
      summary: 'Get drafts',
    },
    createDraft: {
      method: 'POST',
      path: '/v2/drafts',
      body: CreateDraftSchema,
      responses: { 201: DraftResponseSchema },
      summary: 'Create draft',
    },
    updateDraft: {
      method: 'PUT',
      path: '/v2/drafts/:id',
      pathParams: z.object({ id: z.string() }),
      body: UpdateDraftSchema,
      responses: { 200: DraftResponseSchema },
      summary: 'Update draft',
    },
    deleteDraft: {
      method: 'DELETE',
      path: '/v2/drafts/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.object({ success: z.boolean() }) },
      summary: 'Delete draft',
    },
    getDraft: {
      method: 'GET',
      path: '/v2/drafts/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: DraftResponseSchema },
      summary: 'Get draft',
    },
    publishDraft: {
      method: 'POST',
      path: '/v2/drafts/:id/publish',
      pathParams: z.object({ id: z.string() }),
      body: z.object({}),
      responses: { 200: ArticleResponseSchema },
      summary: 'Publish draft',
    },
  });
