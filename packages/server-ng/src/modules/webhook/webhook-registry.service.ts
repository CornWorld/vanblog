import { Injectable, Logger } from '@nestjs/common';

import { HookService } from '../plugin/services/hook.service';

import { WebhookService } from './webhook.service';

@Injectable()
export class WebhookRegistryService {
  private readonly logger = new Logger(WebhookRegistryService.name);
  private readonly activeWebhookRegistrations = new Map<string, Set<string>>();

  constructor(
    private readonly hookService: HookService,
    private readonly webhookService: WebhookService,
  ) {}

  /**
   * Manually trigger a webhook event
   */
  async triggerEvent(event: string, data: Record<string, unknown>): Promise<void> {
    await this.hookService.doAction(event, data);
  }

  /**
   * Get all available webhook events from the plugin system
   */
  getAvailableEvents(): string[] {
    return this.hookService.getAllActionHooks();
  }

  /**
   * Check if an event is supported by the plugin system
   */
  isEventSupported(event: string): boolean {
    return this.hookService.hasAction(event);
  }

  /**
   * Get event categories for better organization
   */
  getEventCategories(): Record<string, string[]> {
    const categories: Record<string, string[]> = {};

    this.getAvailableEvents().forEach((event) => {
      const [category] = event.split('.');

      if (category !== '') {
        if (!(category in categories)) {
          categories[category] = [];
        }
        categories[category].push(event);
      }
    });

    return categories;
  }

  /**
   * Register a webhook to listen for specific events
   */
  registerWebhook(webhookId: number, events: string[]): void {
    events.forEach((event) => {
      if (!this.hookService.hasAction(event)) {
        this.logger.warn(`Event '${event}' is not available in the plugin system`);
        return;
      }

      if (!this.activeWebhookRegistrations.has(event)) {
        // First webhook for this event - register the hook handler
        const registrationId = this.hookService.addAction(
          event,
          async (...args: unknown[]) => {
            const data = args[0] as Record<string, unknown>;
            await this.webhookService.triggerForEvent(event, data);
          },
          1000, // Low priority
        );
        this.activeWebhookRegistrations.set(event, new Set([`hook:${registrationId}`]));
        this.logger.debug(`Registered hook handler for event: ${event}`);
      }

      // Add webhook to the event's subscriber list
      const subscribers = this.activeWebhookRegistrations.get(event);
      if (subscribers) {
        subscribers.add(`webhook:${webhookId}`);
        this.logger.debug(`Webhook ${webhookId} subscribed to event: ${event}`);
      }
    });
  }

  /**
   * Unregister a webhook from specific events
   */
  unregisterWebhook(webhookId: number, events: string[]): void {
    events.forEach((event) => {
      const subscribers = this.activeWebhookRegistrations.get(event);
      if (!subscribers) return;

      subscribers.delete(`webhook:${webhookId}`);
      this.logger.debug(`Webhook ${webhookId} unsubscribed from event: ${event}`);

      // If no webhooks are listening to this event, remove the hook handler
      const hasWebhookSubscribers = Array.from(subscribers).some((sub) =>
        sub.startsWith('webhook:'),
      );
      if (!hasWebhookSubscribers) {
        const hookRegistrationId = Array.from(subscribers).find((sub) => sub.startsWith('hook:'));
        if (hookRegistrationId) {
          const registrationId = hookRegistrationId.replace('hook:', '');
          this.hookService.removeAction(event, registrationId);
          this.activeWebhookRegistrations.delete(event);
          this.logger.debug(`Removed hook handler for event: ${event}`);
        }
      }
    });
  }

  /**
   * Unregister a webhook from all events
   */
  unregisterWebhookFromAllEvents(webhookId: number): void {
    const eventsToUnregister: string[] = [];

    this.activeWebhookRegistrations.forEach((subscribers, event) => {
      if (subscribers.has(`webhook:${webhookId}`)) {
        eventsToUnregister.push(event);
      }
    });

    if (eventsToUnregister.length > 0) {
      this.unregisterWebhook(webhookId, eventsToUnregister);
    }
  }

  /**
   * Get all webhooks subscribed to a specific event
   */
  getWebhooksForEvent(event: string): number[] {
    const subscribers = this.activeWebhookRegistrations.get(event);
    if (!subscribers) return [];

    return Array.from(subscribers)
      .filter((sub) => sub.startsWith('webhook:'))
      .map((sub) => parseInt(sub.replace('webhook:', ''), 10));
  }
}
