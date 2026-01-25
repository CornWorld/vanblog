import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  Webhook,
  WebhookReq,
  WebhookPatch,
  WebhookLog,
  PaginationQuery,
  DeleteResponse,
} from '../runtime/schema.js';

// Webhook list response
export const WebhookList = z.object({
  items: z.array(Webhook),
  total: z.number(),
});

// Webhook log list response
export const WebhookLogList = z.object({
  items: z.array(WebhookLog),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

// Webhook stats response
export const WebhookStats = z.object({
  total: z.number(),
  success: z.number(),
  failed: z.number(),
  timeout: z.number(),
});

// Available webhook events
export const WebhookEvents = z.array(z.string());

// Webhook test/trigger response
export const WebhookTriggerResponse = z.object({
  success: z.boolean(),
  statusCode: z.number().optional(),
  response: z.unknown().optional(),
  error: z.string().optional(),
});

export const createWebhookContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    create: {
      method: 'POST',
      path: '/v2/webhooks',
      body: WebhookReq,
      responses: { 201: Webhook },
    },
    list: {
      method: 'GET',
      path: '/v2/webhooks',
      query: PaginationQuery.optional(),
      responses: { 200: WebhookList },
    },
    events: {
      method: 'GET',
      path: '/v2/webhooks/events',
      responses: { 200: WebhookEvents },
    },
    stats: {
      method: 'GET',
      path: '/v2/webhooks/stats',
      query: z.object({ webhookId: z.coerce.number().optional() }),
      responses: { 200: WebhookStats },
    },
    refresh: {
      method: 'POST',
      path: '/v2/webhooks/refresh',
      body: z.object({}),
      responses: { 200: z.object({ message: z.string() }) },
    },
    register: {
      method: 'POST',
      path: '/v2/webhooks/:id/register',
      pathParams: z.object({ id: z.string() }),
      body: z.object({ events: z.array(z.string()) }),
      responses: { 200: Webhook },
    },
    unregister: {
      method: 'DELETE',
      path: '/v2/webhooks/:id/register',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: Webhook },
    },
    logs: {
      method: 'GET',
      path: '/v2/webhooks/logs',
      query: PaginationQuery.extend({
        webhookId: z.coerce.number().optional(),
        status: z.enum(['success', 'failed', 'timeout']).optional(),
      }),
      responses: { 200: WebhookLogList },
    },
    getOne: {
      method: 'GET',
      path: '/v2/webhooks/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: Webhook },
    },
    update: {
      method: 'PATCH',
      path: '/v2/webhooks/:id',
      pathParams: z.object({ id: z.string() }),
      body: WebhookPatch,
      responses: { 200: Webhook },
    },
    delete: {
      method: 'DELETE',
      path: '/v2/webhooks/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: DeleteResponse },
    },
    test: {
      method: 'POST',
      path: '/v2/webhooks/:id/test',
      pathParams: z.object({ id: z.string() }),
      body: z.object({ event: z.string(), payload: z.record(z.string(), z.unknown()) }),
      responses: { 200: WebhookTriggerResponse },
    },
    trigger: {
      method: 'POST',
      path: '/v2/webhooks/:id/trigger',
      pathParams: z.object({ id: z.string() }),
      body: z.object({ event: z.string(), payload: z.record(z.string(), z.unknown()) }),
      responses: { 200: z.object({ message: z.string() }) },
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const webhookContract = createWebhookContract(c);
