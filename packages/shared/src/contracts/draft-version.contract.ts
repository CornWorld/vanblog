import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { dateStr } from '../date-codecs.js';

export const DraftVersionMetaSchema = z.object({
  id: z.string(),
  draftId: z.string(),
  version: z.string(),
  createdAt: dateStr,
  updatedAt: dateStr.optional(),
});

export const DraftVersionContentSchema = z.object({
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const DraftVersionResponseSchema = z.object({
  meta: DraftVersionMetaSchema,
  data: DraftVersionContentSchema,
});

export const DraftVersionListResponseSchema = z.object({
  items: z.array(DraftVersionMetaSchema),
  total: z.string(),
  page: z.string(),
  pageSize: z.string(),
});

// Export types
export type DraftVersionMeta = z.infer<typeof DraftVersionMetaSchema>;
export type DraftVersionContent = z.infer<typeof DraftVersionContentSchema>;
export type DraftVersionResponse = z.infer<typeof DraftVersionResponseSchema>;
export type DraftVersionListResponse = z.infer<typeof DraftVersionListResponseSchema>;

export const createDraftVersionContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    listVersions: {
      method: 'GET',
      path: '/v2/drafts/:id/versions',
      pathParams: z.object({ id: z.string() }),
      query: z
        .object({
          page: z.string().optional(),
          pageSize: z.string().optional(),
        })
        .optional(),
      responses: { 200: DraftVersionListResponseSchema },
      summary: 'List draft versions (strings-only)',
    },
    getVersion: {
      method: 'GET',
      path: '/v2/drafts/:id/versions/:versionId',
      pathParams: z.object({ id: z.string(), versionId: z.string() }),
      responses: { 200: DraftVersionResponseSchema },
      summary: 'Get specific draft version (strings-only)',
    },
    createVersion: {
      method: 'POST',
      path: '/v2/drafts/:id/versions',
      pathParams: z.object({ id: z.string() }),
      body: z.object({ reason: z.string().optional() }),
      responses: { 201: DraftVersionMetaSchema },
      summary: 'Create a version snapshot (strings-only)',
    },
    deleteVersion: {
      method: 'DELETE',
      path: '/v2/drafts/:id/versions/:versionId',
      pathParams: z.object({ id: z.string(), versionId: z.string() }),
      responses: { 200: z.object({ success: z.enum(['true', 'false']) }) },
      summary: 'Delete a version snapshot (strings-only)',
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const draftVersionContract = createDraftVersionContract(c);

export type DraftVersionContract = typeof draftVersionContract;
