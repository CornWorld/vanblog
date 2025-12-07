import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createWebhookContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    create: { method: 'POST', path: '/v2/webhooks', body: z.any(), responses: { 201: z.any() } },
    list: { method: 'GET', path: '/v2/webhooks', query: z.any(), responses: { 200: z.any() } },
    events: { method: 'GET', path: '/v2/webhooks/events', responses: { 200: z.any() } },
    stats: {
      method: 'GET',
      path: '/v2/webhooks/stats',
      query: z.object({ webhookId: z.coerce.number().optional() }),
      responses: { 200: z.record(z.string(), z.any()) },
    },
    refresh: {
      method: 'POST',
      path: '/v2/webhooks/refresh',
      body: z.object({}),
      responses: { 200: z.any() },
    },
    register: {
      method: 'POST',
      path: '/v2/webhooks/:id/register',
      pathParams: z.object({ id: z.string() }),
      body: z.object({ events: z.array(z.string()) }),
      responses: { 200: z.any() },
    },
    unregister: {
      method: 'DELETE',
      path: '/v2/webhooks/:id/register',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.any() },
    },
    logs: {
      method: 'GET',
      path: '/v2/webhooks/logs',
      query: z.any(),
      responses: { 200: z.record(z.string(), z.any()) },
    },
    getOne: {
      method: 'GET',
      path: '/v2/webhooks/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.any() },
    },
    update: {
      method: 'PATCH',
      path: '/v2/webhooks/:id',
      pathParams: z.object({ id: z.string() }),
      body: z.any(),
      responses: { 200: z.any() },
    },
    delete: {
      method: 'DELETE',
      path: '/v2/webhooks/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.any() },
    },
    test: {
      method: 'POST',
      path: '/v2/webhooks/:id/test',
      pathParams: z.object({ id: z.string() }),
      body: z.object({ event: z.string(), payload: z.record(z.string(), z.any()) }),
      responses: { 200: z.record(z.string(), z.any()) },
    },
    trigger: {
      method: 'POST',
      path: '/v2/webhooks/:id/trigger',
      pathParams: z.object({ id: z.string() }),
      body: z.object({ event: z.string(), payload: z.record(z.string(), z.any()) }),
      responses: { 200: z.object({ message: z.string() }) },
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const webhookContract = createWebhookContract(c);
