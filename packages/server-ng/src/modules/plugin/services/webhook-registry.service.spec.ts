import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MockUtils } from '../../../../test/mock-utils';
import type { HookService } from './hook.service';
import { WebhookRegistryService } from './webhook-registry.service';
import type { WebhookService } from './webhook.service';

describe('WebhookRegistryService', () => {
  let service: WebhookRegistryService;
  let hookService: ReturnType<typeof MockUtils.services.createHookServiceMock>;
  let webhookService: Partial<WebhookService>;

  beforeEach(() => {
    hookService = MockUtils.services.createHookServiceMock();

    webhookService = {
      triggerForEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new WebhookRegistryService(
      hookService as HookService,
      webhookService as WebhookService,
    );
  });

  describe('triggerEvent', () => {
    it('should trigger event via hook service', async () => {
      const event = 'article|afterCreate';
      const data = { articleId: 1, title: 'Test' };

      await service.triggerEvent(event, data);

      expect(hookService.doAction).toHaveBeenCalledWith(event, data);
    });

    it('should handle async trigger', async () => {
      (hookService.doAction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      await service.triggerEvent('test|event', { foo: 'bar' });
      expect(hookService.doAction).toHaveBeenCalled();
    });
  });

  describe('getAvailableEvents', () => {
    it('should return all action hooks from hook service', () => {
      const events = ['article|afterCreate', 'article|afterUpdate', 'comment|afterCreate'];
      (hookService.getAllActionHooks as ReturnType<typeof vi.fn>).mockReturnValue(events);

      const result = service.getAvailableEvents();

      expect(result).toEqual(events);
      expect(hookService.getAllActionHooks).toHaveBeenCalled();
    });

    it('should return empty array when no events', () => {
      (hookService.getAllActionHooks as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const result = service.getAvailableEvents();
      expect(result).toEqual([]);
    });
  });

  describe('isEventSupported', () => {
    it('should return true for supported events', () => {
      (hookService.hasAction as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = service.isEventSupported('article|afterCreate');

      expect(result).toBe(true);
      expect(hookService.hasAction).toHaveBeenCalledWith('article|afterCreate');
    });

    it('should return false for unsupported events', () => {
      (hookService.hasAction as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = service.isEventSupported('nonexistent|event');

      expect(result).toBe(false);
      expect(hookService.hasAction).toHaveBeenCalledWith('nonexistent|event');
    });
  });

  describe('getEventCategories', () => {
    it('should group events by category', () => {
      const events = [
        'article|afterCreate',
        'article|afterUpdate',
        'comment|afterCreate',
        'draft|afterPublish',
      ];
      (hookService.getAllActionHooks as ReturnType<typeof vi.fn>).mockReturnValue(events);

      const result = service.getEventCategories();

      expect(result).toEqual({
        article: ['article|afterCreate', 'article|afterUpdate'],
        comment: ['comment|afterCreate'],
        draft: ['draft|afterPublish'],
      });
    });

    it('should handle empty events list', () => {
      (hookService.getAllActionHooks as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const result = service.getEventCategories();
      expect(result).toEqual({});
    });

    it('should handle events without category prefix', () => {
      (hookService.getAllActionHooks as ReturnType<typeof vi.fn>).mockReturnValue([
        'simple-event',
        'another-event',
      ]);
      const result = service.getEventCategories();
      expect(result).toEqual({
        'simple-event': ['simple-event'],
        'another-event': ['another-event'],
      });
    });

    it('should handle events with multiple pipes', () => {
      (hookService.getAllActionHooks as ReturnType<typeof vi.fn>).mockReturnValue([
        'category|subcategory|event',
      ]);
      const result = service.getEventCategories();
      expect(result).toEqual({
        category: ['category|subcategory|event'],
      });
    });
  });

  describe('registerWebhook', () => {
    it('should register webhook to multiple events', () => {
      const webhookId = 1;
      const events = ['article|afterCreate', 'article|afterUpdate'];
      (hookService.hasAction as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (hookService.addAction as ReturnType<typeof vi.fn>).mockReturnValue('hook-reg-id');

      service.registerWebhook(webhookId, events);

      expect(hookService.addAction).toHaveBeenCalledTimes(2);
      expect(hookService.hasAction).toHaveBeenCalledWith('article|afterCreate');
      expect(hookService.hasAction).toHaveBeenCalledWith('article|afterUpdate');
    });

    it('should skip unsupported events', () => {
      const webhookId = 1;
      const events = ['article|afterCreate', 'invalid|event'];
      (hookService.hasAction as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string) => event === 'article|afterCreate',
      );
      (hookService.addAction as ReturnType<typeof vi.fn>).mockReturnValue('hook-reg-id');

      service.registerWebhook(webhookId, events);

      expect(hookService.addAction).toHaveBeenCalledTimes(1);
    });

    it('should reuse existing hook handler for same event', () => {
      (hookService.hasAction as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (hookService.addAction as ReturnType<typeof vi.fn>).mockReturnValue('hook-reg-id');

      // Register first webhook
      service.registerWebhook(1, ['article|afterCreate']);
      // Register second webhook to same event
      service.registerWebhook(2, ['article|afterCreate']);

      // Should only call addAction once (for the first webhook)
      expect(hookService.addAction).toHaveBeenCalledTimes(1);
    });

    it('should execute webhook trigger when hook fires', async () => {
      (hookService.hasAction as ReturnType<typeof vi.fn>).mockReturnValue(true);
      let capturedHandler: any;
      (hookService.addAction as ReturnType<typeof vi.fn>).mockImplementation(
        (_event: string, handler: any) => {
          capturedHandler = handler;
          return 'hook-reg-id';
        },
      );

      service.registerWebhook(1, ['article|afterCreate']);

      // Simulate hook firing
      const testData = { articleId: 123, title: 'Test Article' };
      await capturedHandler(testData);

      expect(webhookService.triggerForEvent).toHaveBeenCalledWith('article|afterCreate', testData);
    });
  });

  describe('unregisterWebhook', () => {
    beforeEach(() => {
      (hookService.hasAction as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (hookService.addAction as ReturnType<typeof vi.fn>).mockReturnValue('hook-reg-id');
    });

    it('should unregister webhook from events', () => {
      const webhookId = 1;
      const events = ['article|afterCreate'];

      // Register first
      service.registerWebhook(webhookId, events);

      // Then unregister
      service.unregisterWebhook(webhookId, events);

      // Should remove the hook handler when no webhooks listening
      expect(hookService.removeAction).toHaveBeenCalledWith('article|afterCreate', 'hook-reg-id');
    });

    it('should not remove hook handler if other webhooks still listening', () => {
      const event = 'article|afterCreate';

      // Register two webhooks
      service.registerWebhook(1, [event]);
      service.registerWebhook(2, [event]);

      // Unregister only one
      service.unregisterWebhook(1, [event]);

      // Should not remove hook handler
      expect(hookService.removeAction).not.toHaveBeenCalled();
    });

    it('should handle unregistering non-existent webhook gracefully', () => {
      service.unregisterWebhook(999, ['article|afterCreate']);
      expect(hookService.removeAction).not.toHaveBeenCalled();
    });

    it('should handle unregistering from non-existent event gracefully', () => {
      service.registerWebhook(1, ['article|afterCreate']);
      service.unregisterWebhook(1, ['nonexistent|event']);
      expect(hookService.removeAction).not.toHaveBeenCalled();
    });
  });

  describe('unregisterWebhookFromAllEvents', () => {
    beforeEach(() => {
      (hookService.hasAction as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (hookService.addAction as ReturnType<typeof vi.fn>).mockReturnValue('hook-reg-id');
    });

    it('should unregister webhook from all subscribed events', () => {
      const webhookId = 1;
      const events = ['article|afterCreate', 'article|afterUpdate', 'comment|afterCreate'];

      // Register to multiple events
      service.registerWebhook(webhookId, events);

      // Unregister from all
      service.unregisterWebhookFromAllEvents(webhookId);

      // Should remove from all events
      expect(hookService.removeAction).toHaveBeenCalledTimes(3);
    });

    it('should handle webhook not subscribed to any events', () => {
      service.unregisterWebhookFromAllEvents(999);
      expect(hookService.removeAction).not.toHaveBeenCalled();
    });

    it('should not affect other webhooks', () => {
      // Register two webhooks
      service.registerWebhook(1, ['article|afterCreate']);
      service.registerWebhook(2, ['article|afterCreate']);

      // Unregister only one from all events
      service.unregisterWebhookFromAllEvents(1);

      // Should still keep the event active
      const webhooks = service.getWebhooksForEvent('article|afterCreate');
      expect(webhooks).toContain(2);
    });
  });

  describe('getWebhooksForEvent', () => {
    beforeEach(() => {
      (hookService.hasAction as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (hookService.addAction as ReturnType<typeof vi.fn>).mockReturnValue('hook-reg-id');
    });

    it('should return list of webhook IDs for event', () => {
      const event = 'article|afterCreate';

      service.registerWebhook(1, [event]);
      service.registerWebhook(2, [event]);
      service.registerWebhook(3, [event]);

      const webhooks = service.getWebhooksForEvent(event);

      expect(webhooks).toEqual([1, 2, 3]);
    });

    it('should return empty array for event with no webhooks', () => {
      const webhooks = service.getWebhooksForEvent('nonexistent|event');
      expect(webhooks).toEqual([]);
    });

    it('should not include hook registration in webhook list', () => {
      const event = 'article|afterCreate';
      service.registerWebhook(1, [event]);

      const webhooks = service.getWebhooksForEvent(event);

      // Should only include webhook IDs, not hook registration IDs
      expect(webhooks).toEqual([1]);
    });

    it('should update list after unregistering', () => {
      const event = 'article|afterCreate';

      service.registerWebhook(1, [event]);
      service.registerWebhook(2, [event]);

      expect(service.getWebhooksForEvent(event)).toEqual([1, 2]);

      service.unregisterWebhook(1, [event]);

      expect(service.getWebhooksForEvent(event)).toEqual([2]);
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      (hookService.hasAction as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (hookService.addAction as ReturnType<typeof vi.fn>).mockReturnValue('hook-reg-id');
    });

    it('should handle complete webhook lifecycle', () => {
      const webhookId = 1;
      const events = ['article|afterCreate', 'article|afterUpdate'];

      // Register
      service.registerWebhook(webhookId, events);
      expect(service.getWebhooksForEvent('article|afterCreate')).toEqual([1]);
      expect(service.getWebhooksForEvent('article|afterUpdate')).toEqual([1]);

      // Unregister from one event
      service.unregisterWebhook(webhookId, ['article|afterCreate']);
      expect(service.getWebhooksForEvent('article|afterCreate')).toEqual([]);
      expect(service.getWebhooksForEvent('article|afterUpdate')).toEqual([1]);

      // Unregister from all
      service.unregisterWebhookFromAllEvents(webhookId);
      expect(service.getWebhooksForEvent('article|afterUpdate')).toEqual([]);
    });

    it('should handle multiple webhooks on same events', () => {
      const event = 'article|afterCreate';

      service.registerWebhook(1, [event]);
      service.registerWebhook(2, [event]);
      service.registerWebhook(3, [event]);

      expect(service.getWebhooksForEvent(event)).toEqual([1, 2, 3]);

      service.unregisterWebhook(2, [event]);

      expect(service.getWebhooksForEvent(event)).toEqual([1, 3]);

      service.unregisterWebhookFromAllEvents(1);
      service.unregisterWebhookFromAllEvents(3);

      expect(service.getWebhooksForEvent(event)).toEqual([]);
    });
  });
});
