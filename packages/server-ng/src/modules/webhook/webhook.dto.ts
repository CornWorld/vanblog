import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Webhook Schemas
export const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z
    .string()
    .min(1)
    .refine(
      (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Invalid URL format' },
    ),
  events: z.array(z.string()).min(1),
  active: z.boolean().default(true),
  secret: z.string().optional(),
  retryCount: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(1000).max(30000).default(5000),
});

export const UpdateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z
    .string()
    .min(1)
    .refine(
      (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Invalid URL format' },
    )
    .optional(),
  events: z.array(z.string()).min(1).optional(),
  active: z.boolean().optional(),
  secret: z.string().optional(),
  retryCount: z.number().int().min(0).max(10).optional(),
  timeout: z.number().int().min(1000).max(30000).optional(),
});

export const WebhookSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  active: z.boolean(),
  secret: z.string().optional(),
  retryCount: z.number(),
  timeout: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Webhook DTOs
export class CreateWebhookDto extends createZodDto(CreateWebhookSchema) {}
export class UpdateWebhookDto extends createZodDto(UpdateWebhookSchema) {}
export class WebhookDto extends createZodDto(WebhookSchema) {}

export class WebhookLogDto {
  id!: number;
  webhookId!: number;
  event!: string;
  payload!: string;
  status!: 'success' | 'failed' | 'timeout';
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  createdAt!: Date;
}

export class WebhookQueryDto {
  page?: number;
  limit?: number;
  active?: boolean;
  event?: string;
}

export class WebhookLogQueryDto {
  page?: number;
  limit?: number;
  webhookId?: number;
  event?: string;
  status?: 'success' | 'failed' | 'timeout';
  startDate?: Date;
  endDate?: Date;
}

// Webhook events enum
export const WEBHOOK_EVENTS = {
  // Article events
  ARTICLE_CREATED: 'article.created',
  ARTICLE_UPDATED: 'article.updated',
  ARTICLE_DELETED: 'article.deleted',
  ARTICLE_PUBLISHED: 'article.published',
  ARTICLE_UNPUBLISHED: 'article.unpublished',

  // Draft events
  DRAFT_CREATED: 'draft.created',
  DRAFT_UPDATED: 'draft.updated',
  DRAFT_DELETED: 'draft.deleted',
  DRAFT_PUBLISHED: 'draft.published',

  // Category events
  CATEGORY_CREATED: 'category.created',
  CATEGORY_UPDATED: 'category.updated',
  CATEGORY_DELETED: 'category.deleted',

  // Tag events
  TAG_CREATED: 'tag.created',
  TAG_UPDATED: 'tag.updated',
  TAG_DELETED: 'tag.deleted',

  // Media events
  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_DELETED: 'media.deleted',

  // Setting events
  SETTING_UPDATED: 'setting.updated',

  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

export const AVAILABLE_WEBHOOK_EVENTS = Object.values(WEBHOOK_EVENTS);
