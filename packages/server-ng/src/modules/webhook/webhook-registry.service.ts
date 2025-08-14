import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { HookService } from '../plugin/services/hook.service';

import { WEBHOOK_EVENTS, WebhookEvent } from './webhook.dto';
import { WebhookService } from './webhook.service';

@Injectable()
export class WebhookRegistryService implements OnModuleInit {
  private readonly logger = new Logger(WebhookRegistryService.name);

  constructor(
    private readonly hookService: HookService,
    private readonly webhookService: WebhookService,
  ) {}

  onModuleInit(): void {
    this.registerWebhookHooks();
    this.logger.log('Webhook hooks registered successfully');
  }

  private registerWebhookHooks(): void {
    // Register action hooks for all webhook events
    Object.values(WEBHOOK_EVENTS).forEach((event) => {
      this.hookService.addAction(
        event,
        async (...args: unknown[]) => {
          const data = args[0] as Record<string, unknown>;
          await this.webhookService.trigger(event as WebhookEvent, data);
        },
        1, // High priority to ensure webhooks are triggered early
      );
    });

    this.logger.debug(`Registered ${Object.values(WEBHOOK_EVENTS).length} webhook hooks`);
  }

  /**
   * Manually trigger a webhook event
   */
  async triggerEvent(event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
    await this.hookService.doAction(event, data);
  }

  /**
   * Get all available webhook events
   */
  getAvailableEvents(): string[] {
    return Object.values(WEBHOOK_EVENTS);
  }

  /**
   * Check if an event is supported
   */
  isEventSupported(event: string): boolean {
    return Object.values(WEBHOOK_EVENTS).includes(event as WebhookEvent);
  }

  /**
   * Get event categories for better organization
   */
  getEventCategories(): Record<string, string[]> {
    const categories: Record<string, string[]> = {
      article: [],
      draft: [],
      category: [],
      tag: [],
      media: [],
      setting: [],
      user: [],
    };

    Object.values(WEBHOOK_EVENTS).forEach((event) => {
      const [category] = event.split('.');
      if (category !== '' && category in categories) {
        categories[category].push(event);
      }
    });

    return categories;
  }
}
