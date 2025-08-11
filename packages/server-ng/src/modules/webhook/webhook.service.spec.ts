import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';

import { WebhookService } from './webhook.service';

import type { CreateWebhookDto, UpdateWebhookDto, WebhookEvent } from './dto/webhook.dto';

describe('WebhookService', () => {
  let service: WebhookService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new webhook', async () => {
      const createDto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article.created', 'article.updated'],
        active: true,
        secret: 'test-secret',
        retryCount: 3,
        timeout: 30000,
      };

      const expectedResult = {
        id: 1,
        name: createDto.name,
        url: createDto.url,
        events: createDto.events,
        active: createDto.active,
        secret: createDto.secret,
        retryCount: createDto.retryCount,
        timeout: createDto.timeout,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastTriggered: null,
        lastStatus: null,
        lastError: null,
      };

      mockDb.returning.mockResolvedValue([
        {
          ...expectedResult,
          events: JSON.stringify(createDto.events),
        },
      ]);

      const result = await service.create(createDto);

      expect(result).toEqual(expectedResult);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        name: createDto.name,
        url: createDto.url,
        events: JSON.stringify(createDto.events),
        secret: createDto.secret,
        active: createDto.active,
        retryCount: createDto.retryCount,
        timeout: createDto.timeout,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated webhooks', async () => {
      const mockWebhooks = [
        {
          id: 1,
          name: 'Webhook 1',
          url: 'https://example.com/webhook1',
          events: JSON.stringify(['article.created']),
          active: true,
          secret: null,
          retryCount: 3,
          timeout: 30000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Setup mock chain for main query
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue(mockWebhooks);

      // Setup mock for count query
      const countMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 1 }]),
      };
      mockDb.select.mockReturnValueOnce(mockDb).mockReturnValueOnce(countMock);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      const data = result.data as any[];
      expect(data).toHaveLength(1);
      expect(data[0].events).toEqual(['article.created']);
    });
  });

  describe('findOne', () => {
    it('should return a webhook by id', async () => {
      const mockWebhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: JSON.stringify(['article.created']),
        active: true,
        secret: 'test-secret',
        retryCount: 3,
        timeout: 30000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValue([mockWebhook]);

      const result = await service.findOne(1);

      expect(result).toBeDefined();
      expect(result?.events).toEqual(['article.created']);
    });

    it('should return null when webhook not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.findOne(999);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a webhook', async () => {
      const updateDto: UpdateWebhookDto = {
        name: 'Updated Webhook',
        events: ['article.deleted'],
      };

      const updatedWebhook = {
        id: 1,
        name: 'Updated Webhook',
        url: 'https://example.com/webhook',
        events: JSON.stringify(['article.deleted']),
        active: true,
        secret: 'test-secret',
        retryCount: 3,
        timeout: 30000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValue([updatedWebhook]);

      const result = await service.update(1, updateDto);

      expect(result).toBeDefined();
      expect(result?.name).toBe('Updated Webhook');
      expect(result?.events).toEqual(['article.deleted']);
    });

    it('should return null when updating non-existent webhook', async () => {
      mockDb.returning.mockResolvedValue([]);

      const result = await service.update(999, { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete a webhook', async () => {
      await service.remove(1);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('trigger', () => {
    it('should trigger webhooks for specific event', async () => {
      const activeWebhooks = [
        {
          id: 1,
          name: 'Test Webhook',
          url: 'https://example.com/webhook',
          events: JSON.stringify(['article.created']),
          active: true,
          secret: null,
          retryCount: 1,
          timeout: 30000,
        },
      ];

      mockDb.where.mockReturnThis();
      mockDb.where.mockResolvedValue(activeWebhooks);

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
      });

      await service.trigger('article.created' as WebhookEvent, { id: 1, title: 'Test Article' });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('generateSignature', () => {
    it('should generate correct HMAC signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test-secret';

      const signature = (service as any).generateSignature(payload, secret);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });

  describe('getLogs', () => {
    it('should return paginated webhook logs', async () => {
      const mockLogs = [
        {
          id: 1,
          webhookId: 1,
          event: 'article.created',
          payload: JSON.stringify({ id: 1 }),
          status: 'success',
          responseCode: 200,
          responseBody: 'OK',
          error: null,
          duration: 100,
          createdAt: new Date(),
        },
      ];

      // Setup mock chain for main query
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue(mockLogs);

      // Setup mock for count query
      const countMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      };
      mockDb.select.mockReturnValueOnce(mockDb).mockReturnValueOnce(countMock);

      const result = await service.getLogs({ page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('should return webhook statistics', async () => {
      mockDb.where.mockResolvedValue([{ count: 10 }]);

      const result = await service.getStats();

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('timeout');
      expect(result).toHaveProperty('successRate');
    });
  });
});
