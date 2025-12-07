import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import {
  Draft,
  DraftReq,
  DraftPatch,
  DraftList,
  Article,
  PaginationQuery,
  DeleteResponse,
} from '../runtime/schema.js';

// Draft query with category/tag filters
export const DraftQuery = PaginationQuery.extend({
  category: z.string().optional(),
  tag: z.string().optional(),
});

export const createDraftContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getDrafts: {
      method: 'GET',
      path: '/v2/drafts',
      query: DraftQuery,
      responses: { 200: DraftList },
      summary: 'Get drafts',
    },
    createDraft: {
      method: 'POST',
      path: '/v2/drafts',
      body: DraftReq,
      responses: { 201: Draft },
      summary: 'Create draft',
    },
    updateDraft: {
      method: 'PUT',
      path: '/v2/drafts/:id',
      pathParams: z.object({ id: z.string() }),
      body: DraftPatch,
      responses: { 200: Draft },
      summary: 'Update draft',
    },
    deleteDraft: {
      method: 'DELETE',
      path: '/v2/drafts/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: DeleteResponse },
      summary: 'Delete draft',
    },
    getDraft: {
      method: 'GET',
      path: '/v2/drafts/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: Draft },
      summary: 'Get draft',
    },
    publishDraft: {
      method: 'POST',
      path: '/v2/drafts/:id/publish',
      pathParams: z.object({ id: z.string() }),
      body: z.object({}),
      responses: { 200: Article },
      summary: 'Publish draft',
    },
  });
