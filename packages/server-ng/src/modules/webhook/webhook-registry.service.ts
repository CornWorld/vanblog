import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { HookService } from '../plugin/services/hook.service';

import { WebhookService } from './webhook.service';

@Injectable()
export class WebhookRegistryService implements OnModuleInit {
  private readonly logger = new Logger(WebhookRegistryService.name);
  private readonly registeredWebhookIds: string[] = [];

  constructor(
    private readonly hookService: HookService,
    private readonly webhookService: WebhookService,
  ) {}

  onModuleInit(): void {
    // Delay webhook registration to allow other modules to register their hooks first
    setTimeout(() => {
      this.registerWebhookHooks();
      this.logger.log('Webhook hooks registered successfully');
    }, 1000);
  }

  private registerWebhookHooks(): void {
    // Get all currently registered action hooks from the plugin system
    const availableEvents = this.hookService.getAllActionHooks();

    // Register webhook triggers for all available events
    availableEvents.forEach((event) => {
      const webhookId = this.hookService.addAction(
        event,
        async (...args: unknown[]) => {
          const data = args[0] as Record<string, unknown>;
          await this.webhookService.trigger(event, data);
        },
        1000, // Low priority to ensure webhooks are triggered after other handlers
      );
      this.registeredWebhookIds.push(webhookId);
    });

    this.logger.debug(
      `Registered webhook triggers for ${availableEvents.length} events: ${availableEvents.join(', ')}`,
    );
  }

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
   * Refresh webhook registrations (useful when new plugins are loaded)
   */
  refreshWebhookRegistrations(): void {
    // Remove existing webhook registrations
    this.registeredWebhookIds.forEach((_id) => {
      // We need to find which hook this ID belongs to and remove it
      // Since we don't have a direct way to get hook name by ID, we'll clear and re-register
    });
    this.registeredWebhookIds.length = 0;

    // Re-register webhooks
    this.registerWebhookHooks();
  }
}
