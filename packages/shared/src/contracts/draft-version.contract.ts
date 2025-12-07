import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { DraftVersion, PaginationQuery, DeleteResponse } from '../runtime/schema.js';

// Draft version list response
export const DraftVersionList = z.object({
  items: z.array(DraftVersion),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const createDraftVersionContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    listVersions: {
      method: 'GET',
      path: '/v2/drafts/:id/versions',
      pathParams: z.object({ id: z.string() }),
      query: PaginationQuery.optional(),
      responses: { 200: DraftVersionList },
      summary: 'List draft versions',
    },
    getVersion: {
      method: 'GET',
      path: '/v2/drafts/:id/versions/:versionId',
      pathParams: z.object({ id: z.string(), versionId: z.string() }),
      responses: { 200: DraftVersion },
      summary: 'Get specific draft version',
    },
    createVersion: {
      method: 'POST',
      path: '/v2/drafts/:id/versions',
      pathParams: z.object({ id: z.string() }),
      body: z.object({ reason: z.string().optional() }),
      responses: { 201: DraftVersion },
      summary: 'Create a version snapshot',
    },
    deleteVersion: {
      method: 'DELETE',
      path: '/v2/drafts/:id/versions/:versionId',
      pathParams: z.object({ id: z.string(), versionId: z.string() }),
      responses: { 200: DeleteResponse },
      summary: 'Delete a version snapshot',
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const draftVersionContract = createDraftVersionContract(c);

export type DraftVersionContract = typeof draftVersionContract;
