import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { nowIsoTz } from '@vanblog/shared/runtime';

import type { z } from 'zod';

export const webhooks = sqliteTable('webhooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  events: text('events').notNull(), // JSON array of event names
  secret: text('secret'), // Optional secret for signature verification
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  retryCount: integer('retry_count').notNull().default(3),
  timeout: integer('timeout').notNull().default(30000), // 30 seconds
  lastTriggered: text('last_triggered'), // ISO 8601 string
  lastStatus: text('last_status'), // 'success', 'failed', 'timeout'
  lastError: text('last_error'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => nowIsoTz()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => nowIsoTz()),
});

export const webhookLogs = sqliteTable('webhook_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  webhookId: integer('webhook_id')
    .notNull()
    .references(() => webhooks.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: text('payload').notNull(), // JSON payload
  status: text('status').notNull(), // 'success', 'failed', 'timeout'
  responseCode: integer('response_code'),
  responseBody: text('response_body'),
  error: text('error'),
  duration: integer('duration'), // milliseconds
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => nowIsoTz()),
});

// Zod schemas
export const WebhookSchema = createSelectSchema(webhooks);

export const CreateWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  lastTriggered: true,
  lastStatus: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateWebhookSchema = CreateWebhookSchema.partial();

export const WebhookLogSchema = createSelectSchema(webhookLogs);

export type Webhook = z.infer<typeof WebhookSchema>;
export type CreateWebhook = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhook = z.infer<typeof UpdateWebhookSchema>;
export type WebhookLog = z.infer<typeof WebhookLogSchema>;
