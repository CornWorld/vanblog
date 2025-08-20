import { createZodDto } from 'nestjs-zod';

import {
  insertWebhookSchema,
  updateWebhookSchema,
  selectWebhookSchema,
} from '../../../database/zod-schemas';

// Webhook DTOs - directly using centralized schemas
export class CreateWebhookDto extends createZodDto(insertWebhookSchema) {}
export class UpdateWebhookDto extends createZodDto(updateWebhookSchema) {}
export class WebhookDto extends createZodDto(selectWebhookSchema) {}

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
