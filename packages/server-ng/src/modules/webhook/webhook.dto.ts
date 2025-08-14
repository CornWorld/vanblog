// Webhook DTOs

export class CreateWebhookDto {
  name!: string;
  url!: string;
  events!: string[];
  active?: boolean;
  secret?: string;
  retryCount?: number;
  timeout?: number;
}

export class UpdateWebhookDto {
  name?: string;
  url?: string;
  events?: string[];
  active?: boolean;
  secret?: string;
  retryCount?: number;
  timeout?: number;
}

export class WebhookDto {
  id!: number;
  name!: string;
  url!: string;
  events!: string[];
  active!: boolean;
  secret?: string;
  retryCount!: number;
  timeout!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

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
