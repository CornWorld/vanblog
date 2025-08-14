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

// Note: Webhook events are now dynamically loaded from the plugin system
// via HookService.getAllActionHooks() instead of being hardcoded here.
// This allows plugins to register their own webhook events.

// Legacy type for backward compatibility - now just a string
export type WebhookEvent = string;
