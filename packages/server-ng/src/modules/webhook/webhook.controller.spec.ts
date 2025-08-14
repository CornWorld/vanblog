import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

import type { CreateWebhookDto, UpdateWebhookDto, WebhookQueryDto } from './webhook.dto';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: WebhookService;
  let webhookRegistryService: WebhookRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useValue: {
            create: vi.fn(),
            findAll: vi.fn(),
            findOne: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
            test: vi.fn(),
            getLogs: vi.fn(),
            getStats: vi.fn(),
          },
        },
        {
          provide: WebhookRegistryService,
          useValue: {
            getEventCategories: vi.fn(),
            isEventSupported: vi.fn(),
            triggerEvent: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    webhookService = module.get<WebhookService>(WebhookService);
    webhookRegistryService = module.get<WebhookRegistryService>(WebhookRegistryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new webhook', async () => {
      const createDto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article.created'],
        active: true,
        retryCount: 3,
        timeout: 5000,
      };

      const mockWebhook = {
        id: 1,
        name: createDto.name,
        url: createDto.url,
        events: createDto.events,
        active: true,
        secret: 'test-secret',
        retryCount: 3,
        timeout: 30000,
        lastTriggered: null,
        lastStatus: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(webhookService, 'create').mockResolvedValue(mockWebhook);

      const result = await controller.create(createDto);

      expect(result).toEqual({
        ...mockWebhook,
        secret: 'test-secret',
      });
      expect(webhookService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return all webhooks with pagination', async () => {
      const query: WebhookQueryDto = { page: 1, limit: 10 };
      const mockResult = {
        data: [
          {
            id: 1,
            name: 'Test Webhook',
            url: 'https://example.com/webhook',
            events: ['article.created'],
            active: true,
            secret: null,
            retryCount: 3,
            timeout: 30000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      vi.spyOn(webhookService, 'findAll').mockResolvedValue(mockResult);

      const result = await controller.findAll(query);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 10);
      expect(webhookService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('getAvailableEvents', () => {
    it('should return available webhook events', () => {
      const mockCategories = {
        article: ['article.created', 'article.updated'],
        draft: ['draft.created', 'draft.updated'],
      };

      vi.spyOn(webhookRegistryService, 'getEventCategories').mockReturnValue(mockCategories);

      const result = controller.getAvailableEvents();

      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('categories');
      expect(result.categories).toEqual(mockCategories);
    });
  });

  describe('getStats', () => {
    it('should return webhook statistics', async () => {
      const mockStats = {
        total: 100,
        success: 90,
        failed: 8,
        timeout: 2,
        successRate: 0.9,
      };

      vi.spyOn(webhookService, 'getStats').mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual(mockStats);
    });
  });

  describe('getLogs', () => {
    it('should return webhook logs', async () => {
      const mockLogs = {
        data: [
          {
            id: 1,
            webhookId: 1,
            event: 'article.created',
            status: 'success',
            createdAt: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
        },
      };

      vi.spyOn(webhookService, 'getLogs').mockResolvedValue(mockLogs);

      const result = await controller.getLogs({ page: 1, limit: 10 });

      expect(result).toEqual(mockLogs);
    });
  });

  describe('findOne', () => {
    it('should return a webhook by id', async () => {
      const mockWebhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article.created'],
        active: true,
        secret: null,
        retryCount: 3,
        timeout: 30000,
        lastTriggered: null,
        lastStatus: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(webhookService, 'findOne').mockResolvedValue(mockWebhook);

      const result = await controller.findOne(1);

      expect(result).toEqual(mockWebhook);
      expect(webhookService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when webhook not found', async () => {
      vi.spyOn(webhookService, 'findOne').mockResolvedValue(null);

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a webhook', async () => {
      const updateDto: UpdateWebhookDto = {
        name: 'Updated Webhook',
      };

      const mockWebhook = {
        id: 1,
        name: 'Updated Webhook',
        url: 'https://example.com/webhook',
        events: ['article.created'],
        active: true,
        secret: null,
        retryCount: 3,
        timeout: 30000,
        lastTriggered: null,
        lastStatus: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(webhookService, 'update').mockResolvedValue(mockWebhook);

      const result = await controller.update(1, updateDto);

      expect(result).toEqual(mockWebhook);
      expect(webhookService.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('should throw NotFoundException when updating non-existent webhook', async () => {
      vi.spyOn(webhookService, 'update').mockResolvedValue(null);

      await expect(controller.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a webhook', async () => {
      vi.spyOn(webhookService, 'remove').mockResolvedValue();

      const result = await controller.remove(1);

      expect(result).toEqual({ message: 'Webhook deleted successfully' });
      expect(webhookService.remove).toHaveBeenCalledWith(1);
    });
  });

  describe('test', () => {
    it('should test a webhook', async () => {
      const testData = {
        event: 'article.created',
        payload: { id: 1, title: 'Test' },
      };

      const mockWebhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article.created'],
        active: true,
        secret: null,
        retryCount: 3,
        timeout: 30000,
        lastTriggered: null,
        lastStatus: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTestResult = {
        success: true,
        status: 'success',
        duration: 100,
        attempts: 1,
      };

      vi.spyOn(webhookService, 'findOne').mockResolvedValue(mockWebhook);
      vi.spyOn(webhookService, 'test').mockResolvedValue(mockTestResult);

      const result = await controller.test(1, testData);

      expect(result).toEqual(mockTestResult);
      expect(webhookService.test).toHaveBeenCalledWith(1, testData);
    });

    it('should throw NotFoundException when testing non-existent webhook', async () => {
      vi.spyOn(webhookService, 'findOne').mockResolvedValue(null);

      await expect(controller.test(999, { event: 'test', payload: {} })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('trigger', () => {
    it('should manually trigger a webhook', async () => {
      const triggerData = {
        event: 'article.created',
        payload: { id: 1, title: 'Test' },
      };

      const mockWebhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article.created'],
        active: true,
        secret: null,
        retryCount: 3,
        timeout: 30000,
        lastTriggered: null,
        lastStatus: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(webhookService, 'findOne').mockResolvedValue(mockWebhook);
      vi.spyOn(webhookRegistryService, 'isEventSupported').mockReturnValue(true);
      vi.spyOn(webhookRegistryService, 'triggerEvent').mockResolvedValue();

      const result = await controller.trigger(1, triggerData);

      expect(result).toEqual({ message: 'Webhook triggered successfully' });
      expect(webhookRegistryService.triggerEvent).toHaveBeenCalledWith(
        triggerData.event,
        triggerData.payload,
      );
    });

    it('should throw NotFoundException when event not supported', async () => {
      const mockWebhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article.created'],
        active: true,
        secret: null,
        retryCount: 3,
        timeout: 30000,
        lastTriggered: null,
        lastStatus: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(webhookService, 'findOne').mockResolvedValue(mockWebhook);
      vi.spyOn(webhookRegistryService, 'isEventSupported').mockReturnValue(false);

      await expect(controller.trigger(1, { event: 'invalid.event', payload: {} })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
