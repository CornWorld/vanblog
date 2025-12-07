import { initContract } from '@ts-rest/core';
import { dateStr } from '@vanblog/shared';
import { z } from 'zod';

const c = initContract();

export const webhookContract = c.router({
  create: { method: 'POST', path: '/v2/webhooks', body: z.any(), responses: { 201: z.any() } },
  list: {
    method: 'GET',
    path: '/v2/webhooks',
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      active: z.coerce.boolean().optional(),
      event: z.string().optional(),
    }),
    responses: {
      200: z.object({
        data: z.array(z.any()),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
      }),
    },
  },
  events: {
    method: 'GET',
    path: '/v2/webhooks/events',
    responses: {
      200: z.object({
        events: z.array(z.string()),
        categories: z.record(z.string(), z.array(z.string())),
      }),
    },
  },
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
    responses: { 200: z.object({ message: z.string(), events: z.array(z.string()) }) },
  },
  register: {
    method: 'POST',
    path: '/v2/webhooks/:id/register',
    pathParams: z.object({ id: z.string() }),
    body: z.object({ events: z.array(z.string()) }),
    responses: { 200: z.object({ message: z.string(), registeredEvents: z.array(z.string()) }) },
  },
  unregister: {
    method: 'DELETE',
    path: '/v2/webhooks/:id/register',
    pathParams: z.object({ id: z.string() }),
    responses: { 200: z.object({ message: z.string() }) },
  },
  logs: {
    method: 'GET',
    path: '/v2/webhooks/logs',
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      webhookId: z.coerce.number().optional(),
      event: z.string().optional(),
      status: z.enum(['success', 'failed', 'timeout']).optional(),
      startDate: dateStr.optional(),
      endDate: dateStr.optional(),
    }),
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
    responses: { 200: z.object({ message: z.string() }) },
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
export { webhookContract as sharedWebhookContract } from '@vanblog/shared/src/contracts/webhook.contract';
