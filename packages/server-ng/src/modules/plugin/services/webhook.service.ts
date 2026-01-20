import { createHmac } from 'crypto';

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { insertWebhookSchema, updateWebhookSchema } from '@vanblog/shared/drizzle';
import { nowIsoTz } from '@vanblog/shared/runtime';
import dayjs from 'dayjs';
import { eq, and, desc, count, like, sql } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE_CONNECTION, type Database } from '../../../database';
import { webhooks, webhookLogs, type Webhook as WebhookEntity } from '../entities/webhook.schema';

import { WebhookRegistryService } from './webhook-registry.service';

// Custom Webhook interface with parsed events
export interface Webhook extends Omit<WebhookEntity, 'events'> {
  events: string[];
}

/**
 * Webhook payload sent to external endpoints
 *
 * @note Special case: Uses Unix timestamp (number) instead of ISO string
 * @reason External webhook endpoints expect numeric timestamp for compatibility
 */
export interface WebhookPayload {
  event: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  data: Record<string, unknown>;
  source: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(forwardRef(() => WebhookRegistryService))
    private readonly webhookRegistry: WebhookRegistryService,
  ) {}

  async create(createWebhookDto: z.infer<typeof insertWebhookSchema>): Promise<Webhook> {
    const eventsJson = JSON.stringify(createWebhookDto.events);

    const [webhook] = await this.db
      .insert(webhooks)
      .values({
        name: createWebhookDto.name,
        url: createWebhookDto.url,
        events: eventsJson,
        secret: createWebhookDto.secret,
        active: createWebhookDto.active,
        retryCount: createWebhookDto.retryCount,
        timeout: createWebhookDto.timeout,
      })
      .returning();

    const result = {
      ...webhook,
      events: JSON.parse(webhook.events) as string[],
    };

    // Register webhook for its events if active
    if (result.active) {
      this.webhookRegistry.registerWebhook(result.id, result.events);
    }

    return result;
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    active?: boolean;
    event?: string;
  }): Promise<Record<string, unknown>> {
    const { page = 1, limit = 10, active, event } = query;
    const offset = (page - 1) * limit;

    const whereConditions = [];

    if (active !== undefined) {
      whereConditions.push(eq(webhooks.active, active));
    }

    if (event) {
      // Search for event in the JSON array (stored as string)
      whereConditions.push(like(webhooks.events, `%"${event}"%`));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const results = await this.db
      .select()
      .from(webhooks)
      .where(whereClause)
      .orderBy(desc(webhooks.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await this.db.select({ count: count() }).from(webhooks).where(whereClause);

    const totalCount = totalRow.count;

    return {
      data: results.map((webhook) => ({
        ...webhook,
        events: JSON.parse(webhook.events) as string[],
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(id: number): Promise<Webhook | null> {
    const results = await this.db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);

    if (results.length === 0) {
      return null;
    }

    const [webhook] = results;

    const result = {
      ...webhook,
      events: JSON.parse(webhook.events) as string[],
    };

    // Update webhook registration
    this.webhookRegistry.unregisterWebhookFromAllEvents(id);
    if (result.active) {
      this.webhookRegistry.registerWebhook(result.id, result.events);
    }

    return result;
  }

  async update(
    id: number,
    updateWebhookDto: z.infer<typeof updateWebhookSchema>,
  ): Promise<Webhook | null> {
    const updateData: Record<string, unknown> = {
      name: updateWebhookDto.name,
      url: updateWebhookDto.url,
      secret: updateWebhookDto.secret,
      active: updateWebhookDto.active,
      retryCount: updateWebhookDto.retryCount,
      timeout: updateWebhookDto.timeout,
      events: updateWebhookDto.events,
    };

    const results = await this.db
      .update(webhooks)
      .set({
        ...updateData,
        updatedAt: nowIsoTz(),
      })
      .where(eq(webhooks.id, id))
      .returning();

    if (results.length === 0) {
      return null;
    }

    const [webhook] = results;

    return {
      ...webhook,
      events: JSON.parse(webhook.events) as string[],
    };
  }

  async remove(id: number): Promise<void> {
    // Unregister webhook before deletion
    this.webhookRegistry.unregisterWebhookFromAllEvents(id);

    await this.db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async trigger(event: string, data: Record<string, unknown>): Promise<void> {
    const activeWebhooks = await this.db.select().from(webhooks).where(eq(webhooks.active, true));

    const relevantWebhooks = activeWebhooks.filter((webhook) => {
      const events = JSON.parse(webhook.events) as string[];
      return events.includes(event);
    });

    this.logger.debug(`Triggering ${String(relevantWebhooks.length)} webhooks for event: ${event}`);

    const promises = relevantWebhooks.map(async (webhook) => {
      const webhookWithParsedEvents: Webhook = {
        ...webhook,
        events: JSON.parse(webhook.events) as string[],
      };
      return this.executeWebhook(webhookWithParsedEvents, event, data);
    });

    await Promise.allSettled(promises);
  }

  async triggerForEvent(event: string, data: Record<string, unknown>): Promise<void> {
    return this.trigger(event, data);
  }

  async test(
    id: number,
    testData: { event: string; payload: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    const webhook = await this.findOne(id);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    return this.executeWebhook(webhook, testData.event, testData.payload);
  }

  private async executeWebhook(
    webhook: Webhook,
    event: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    const payload: string = JSON.stringify({
      event,
      timestamp: Date.now(),
      data,
      source: 'server-ng',
    });

    const payloadString = payload;
    let attempt = 0;
    let lastError: string | null = null;
    let success = false;
    let responseCode: number | null = null;
    let responseBody: string | null = null;

    while (attempt < webhook.retryCount && !success) {
      attempt++;

      try {
        this.logger.debug(
          `Executing webhook ${webhook.name} (attempt ${String(attempt)}/${String(webhook.retryCount)})`,
        );

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'VanBlog-Webhook/1.0',
          'X-VanBlog-Event': event,
          'X-VanBlog-Timestamp': startTime.toString(),
        };

        // Add signature if secret is provided
        if (webhook.secret) {
          const signature = this.generateSignature(payloadString, webhook.secret);
          headers['X-VanBlog-Signature'] = signature;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, webhook.timeout);

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: payloadString,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        responseCode = response.status;
        responseBody = await response.text();

        if (response.ok) {
          success = true;
          this.logger.debug(`Webhook ${webhook.name} executed successfully`);
        } else {
          lastError = `HTTP ${String(response.status)}: ${responseBody}`;
          this.logger.warn(
            `Webhook ${webhook.name} failed with status ${String(response.status)}: ${responseBody}`,
          );
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = 'Request timeout';
          } else {
            lastError = error.message;
          }
        } else {
          lastError = 'Unknown error';
        }

        this.logger.error(
          `Webhook ${webhook.name} failed (attempt ${String(attempt)}): ${lastError}`,
        );
      }

      // Wait before retry (exponential backoff)
      if (!success && attempt < webhook.retryCount) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const duration = Date.now() - startTime;
    let status: string;
    if (success) {
      status = 'success';
    } else if (lastError?.includes('timeout') === true) {
      status = 'timeout';
    } else {
      status = 'failed';
    }

    // Update webhook status
    await this.db
      .update(webhooks)
      .set({
        lastTriggered: dayjs().toISOString(),
        lastStatus: status,
        lastError: success ? null : lastError,
        updatedAt: dayjs().toISOString(),
      })
      .where(eq(webhooks.id, webhook.id));

    // Log the execution
    await this.db.insert(webhookLogs).values({
      webhookId: webhook.id,
      event,
      payload: payloadString,
      status,
      responseCode,
      responseBody,
      error: success ? null : lastError,
      duration,
    });

    return {
      success,
      status,
      duration,
      attempts: attempt,
      error: lastError,
      responseCode,
      responseBody,
    };
  }

  private generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  async getLogs(query: {
    page?: number;
    limit?: number;
    webhookId?: number;
    event?: string;
    status?: 'success' | 'failed' | 'timeout';
    startDate?: string;
    endDate?: string;
  }): Promise<{
    data: Array<{
      id: number;
      webhookId: number;
      event: string;
      payload: Record<string, unknown> | string;
      status: string;
      responseCode: number | null;
      errorMessage: string | null;
      executionTime: number | null;
      createdAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 10, webhookId, event, status, startDate, endDate } = query;
    const offset = (page - 1) * limit;

    const whereConditions = [];

    if (webhookId) {
      whereConditions.push(eq(webhookLogs.webhookId, webhookId));
    }

    if (event) {
      whereConditions.push(eq(webhookLogs.event, event));
    }

    if (status !== undefined) {
      whereConditions.push(eq(webhookLogs.status, status));
    }

    if (startDate) {
      const sd = dayjs(startDate).startOf('day').toISOString();
      whereConditions.push(sql`${webhookLogs.createdAt} >= ${sd}`);
    }

    if (endDate) {
      const ed = dayjs(endDate).endOf('day').toISOString();
      whereConditions.push(sql`${webhookLogs.createdAt} <= ${ed}`);
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const results = await this.db
      .select()
      .from(webhookLogs)
      .where(whereClause)
      .orderBy(desc(webhookLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await this.db
      .select({ count: count() })
      .from(webhookLogs)
      .where(whereClause);

    const totalCount = totalResult.count;

    return {
      data: results.map((log) => {
        let parsedPayload: Record<string, unknown>;

        // Check if payload is already an object (parsed by Drizzle's mode: 'json')
        if (typeof log.payload === 'object' && log.payload !== null) {
          // Already parsed by Drizzle
          parsedPayload = log.payload;
        } else {
          // Try to parse as JSON string
          try {
            parsedPayload = JSON.parse(log.payload);
          } catch (error) {
            this.logger.error('JSON.parse error in getLogs:', error);
            // Return empty object if parsing fails
            parsedPayload = {} as Record<string, unknown>;
          }
        }

        return {
          id: log.id,
          webhookId: log.webhookId,
          event: log.event,
          payload: parsedPayload,
          status: log.status,
          responseCode: log.responseCode,
          errorMessage: log.error,
          executionTime: log.duration,
          createdAt: log.createdAt,
        };
      }),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async getStats(webhookId?: number): Promise<Record<string, number>> {
    const baseFilter = webhookId ? eq(webhookLogs.webhookId, webhookId) : undefined;

    const [totalLogs] = await this.db
      .select({ count: count() })
      .from(webhookLogs)
      .where(baseFilter);

    const successCond = baseFilter
      ? and(baseFilter, eq(webhookLogs.status, 'success'))
      : eq(webhookLogs.status, 'success');
    const [successLogs] = await this.db
      .select({ count: count() })
      .from(webhookLogs)
      .where(successCond);

    const failedCond = baseFilter
      ? and(baseFilter, eq(webhookLogs.status, 'failed'))
      : eq(webhookLogs.status, 'failed');
    const [failedLogs] = await this.db
      .select({ count: count() })
      .from(webhookLogs)
      .where(failedCond);

    const timeoutCond = baseFilter
      ? and(baseFilter, eq(webhookLogs.status, 'timeout'))
      : eq(webhookLogs.status, 'timeout');
    const [timeoutLogs] = await this.db
      .select({ count: count() })
      .from(webhookLogs)
      .where(timeoutCond);

    const totalCount = totalLogs.count;
    const successCount = successLogs.count;

    return {
      total: totalCount,
      success: successCount,
      failed: failedLogs.count,
      timeout: timeoutLogs.count,
      successRate: totalCount > 0 ? successCount / totalCount : 0,
    };
  }
}
