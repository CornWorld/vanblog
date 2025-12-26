/**
 * WebhookService - Core CRUD Tests
 *
 * 测试 Webhook 核心 CRUD 操作
 *
 * 测试覆盖：
 * - CRUD 操作（create, findAll, findOne, update, remove）
 * - Webhook 触发逻辑（trigger, triggerForEvent）
 * - Webhook 测试功能（test）
 * - Webhook 注册表集成
 * - 事件订阅过滤
 *
 * 相关测试：
 * - webhook.service.execution.spec.ts - 执行与重试机制
 * - webhook.service.security.spec.ts - 安全验证
 * - webhook.service.logging.spec.ts - 日志与统计
 */

import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

import { DATABASE_CONNECTION } from '../../../database';
import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookService } from './webhook.service';

// Mock fetch globally
global.fetch = vi.fn();

describe('WebhookService', () => {
  let service: WebhookService;
  let mockDb: {
    insert: Mock;
    select: Mock;
    update: Mock;
    delete: Mock;
    $client: { execute: Mock };
  };
  let mockWebhookRegistry: {
    registerWebhook: Mock;
    unregisterWebhookFromAllEvents: Mock;
  };

  beforeEach(async () => {
    // Mock database
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      $client: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    };

    // Mock webhook registry
    mockWebhookRegistry = {
      registerWebhook: vi.fn(),
      unregisterWebhookFromAllEvents: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: WebhookRegistryService,
          useValue: mockWebhookRegistry,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);

    // Mock logger to avoid console output during tests
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('create', () => {
    it('should create a webhook with active registration', async () => {
      const createDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article|afterCreate', 'article|afterUpdate'],
        secret: 'test-secret',
        active: true,
        retryCount: 3,
        timeout: 30000,
      };

      const dbWebhook = {
        id: 1,
        name: createDto.name,
        url: createDto.url,
        events: JSON.stringify(createDto.events),
        secret: createDto.secret,
        active: true,
        retryCount: 3,
        timeout: 30000,
        lastTriggered: null,
        lastStatus: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([dbWebhook]),
        }),
      });

      const result = await service.create(createDto);

      expect(result).toEqual({
        ...dbWebhook,
        events: createDto.events,
      });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockWebhookRegistry.registerWebhook).toHaveBeenCalledWith(1, createDto.events);
    });

    it('should create webhook without registration if inactive', async () => {
      const createDto = {
        name: 'Inactive Webhook',
        url: 'https://example.com/webhook',
        events: ['article|afterCreate'],
        active: false,
        retryCount: 3,
        timeout: 30000,
      };

      const dbWebhook = {
        id: 2,
        name: createDto.name,
        url: createDto.url,
        events: JSON.stringify(createDto.events),
        secret: null,
        active: false,
        retryCount: 3,
        timeout: 30000,
        lastTriggered: null,
        lastStatus: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([dbWebhook]),
        }),
      });

      const result = await service.create(createDto);

      expect(result.active).toBe(false);
      expect(mockWebhookRegistry.registerWebhook).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated webhooks', async () => {
      const webhooks = [
        {
          id: 1,
          name: 'Webhook 1',
          url: 'https://example.com/1',
          events: JSON.stringify(['article|afterCreate']),
          active: true,
          retryCount: 3,
          timeout: 30000,
          createdAt: new Date(),
        },
        {
          id: 2,
          name: 'Webhook 2',
          url: 'https://example.com/2',
          events: JSON.stringify(['draft|afterPublish']),
          active: false,
          retryCount: 3,
          timeout: 30000,
          createdAt: new Date(),
        },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(webhooks),
              }),
            }),
          }),
        }),
      });

      // Mock count query
      const countMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(webhooks),
              }),
            }),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce(countMock());

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
      expect((result as any).data[0].events).toEqual(['article|afterCreate']);
    });

    it('should filter by active status', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      await service.findAll({ active: true });

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should filter by event', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      await service.findAll({ event: 'article|afterCreate' });

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a webhook by id', async () => {
      const webhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: JSON.stringify(['article|afterCreate']),
        active: true,
        retryCount: 3,
        timeout: 30000,
        createdAt: new Date(),
      };

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([webhook]),
          }),
        }),
      });

      const result = await service.findOne(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.events).toEqual(['article|afterCreate']);
      expect(mockWebhookRegistry.unregisterWebhookFromAllEvents).toHaveBeenCalledWith(1);
      expect(mockWebhookRegistry.registerWebhook).toHaveBeenCalledWith(1, ['article|afterCreate']);
    });

    it('should return null if webhook not found', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.findOne(999);

      expect(result).toBeNull();
    });

    it('should not register inactive webhook', async () => {
      const webhook = {
        id: 1,
        name: 'Inactive Webhook',
        url: 'https://example.com/webhook',
        events: JSON.stringify(['article|afterCreate']),
        active: false,
        retryCount: 3,
        timeout: 30000,
        createdAt: new Date(),
      };

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([webhook]),
          }),
        }),
      });

      await service.findOne(1);

      expect(mockWebhookRegistry.unregisterWebhookFromAllEvents).toHaveBeenCalledWith(1);
      expect(mockWebhookRegistry.registerWebhook).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a webhook', async () => {
      const updateDto = {
        name: 'Updated Webhook',
        url: 'https://example.com/updated',
        events: ['article|afterUpdate'],
        active: true,
      };

      const updatedWebhook = {
        id: 1,
        name: updateDto.name,
        url: updateDto.url,
        events: JSON.stringify(updateDto.events),
        active: true,
        retryCount: 3,
        timeout: 30000,
        updatedAt: new Date(),
      };

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedWebhook]),
          }),
        }),
      });

      const result = await service.update(1, updateDto);

      expect(result).toBeDefined();
      expect(result?.name).toBe('Updated Webhook');
      expect(result?.events).toEqual(['article|afterUpdate']);
    });

    it('should return null if webhook not found', async () => {
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.update(999, { name: 'Not Found' });

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete a webhook', async () => {
      mockDb.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await service.remove(1);

      expect(mockWebhookRegistry.unregisterWebhookFromAllEvents).toHaveBeenCalledWith(1);
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('trigger', () => {
    it('should trigger webhooks for an event', async () => {
      const webhooks = [
        {
          id: 1,
          name: 'Webhook 1',
          url: 'https://example.com/1',
          events: JSON.stringify(['article|afterCreate', 'article|afterUpdate']),
          secret: null,
          active: true,
          retryCount: 1,
          timeout: 5000,
        },
        {
          id: 2,
          name: 'Webhook 2',
          url: 'https://example.com/2',
          events: JSON.stringify(['article|afterCreate']),
          secret: 'test-secret',
          active: true,
          retryCount: 1,
          timeout: 5000,
        },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(webhooks),
        }),
      });

      // Mock successful fetch
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
      });

      // Mock update and insert operations
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      await service.trigger('article|afterCreate', { articleId: 1 });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockDb.update).toHaveBeenCalledTimes(2);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should only trigger webhooks subscribed to the event', async () => {
      const webhooks = [
        {
          id: 1,
          name: 'Webhook 1',
          url: 'https://example.com/1',
          events: JSON.stringify(['article|afterCreate']),
          active: true,
          retryCount: 1,
          timeout: 5000,
        },
        {
          id: 2,
          name: 'Webhook 2',
          url: 'https://example.com/2',
          events: JSON.stringify(['draft|afterPublish']),
          active: true,
          retryCount: 1,
          timeout: 5000,
        },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(webhooks),
        }),
      });

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
      });

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      await service.trigger('article|afterCreate', { articleId: 1 });

      // Only one webhook should be triggered
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('triggerForEvent', () => {
    it('should call trigger method', async () => {
      const triggerSpy = vi.spyOn(service, 'trigger').mockResolvedValue();

      await service.triggerForEvent('article|afterCreate', { articleId: 1 });

      expect(triggerSpy).toHaveBeenCalledWith('article|afterCreate', { articleId: 1 });

      triggerSpy.mockRestore();
    });
  });

  describe('test', () => {
    it('should execute a test webhook', async () => {
      const webhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article|afterCreate'],
        secret: null,
        active: true,
        retryCount: 1,
        timeout: 5000,
        lastTriggered: null,
        lastStatus: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(service, 'findOne').mockResolvedValue(webhook);

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
      });

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const result = await service.test(1, {
        event: 'article|afterCreate',
        payload: { test: true },
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(result.responseCode).toBe(200);
    });

    it('should throw error if webhook not found', async () => {
      vi.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(
        service.test(999, {
          event: 'test|event',
          payload: {},
        }),
      ).rejects.toThrow('Webhook not found');
    });
  });
});
