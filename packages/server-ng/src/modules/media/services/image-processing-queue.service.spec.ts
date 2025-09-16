import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../../database';

import { ImageProcessingQueueService } from './image-processing-queue.service';
import { ImageProcessingService } from './image-processing.service';

describe('ImageProcessingQueueService', () => {
  let service: ImageProcessingQueueService;
  let mockDatabase: any;
  let mockImageProcessingService: any;

  beforeEach(async () => {
    mockDatabase = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 1,
              fileId: 123,
              status: 'pending',
              priority: 0,
              processingConfig: '{"quality":80}',
              originalBuffer: 'base64string',
              processedBuffer: null,
              errorMessage: null,
              attempts: 0,
              maxAttempts: 3,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              startedAt: null,
              completedAt: null,
            },
          ]),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    mockImageProcessingService = {
      compressImage: vi.fn().mockResolvedValue({
        success: true,
        outputBuffer: Buffer.from('compressed'),
        metadata: {
          originalSize: 1000000,
          compressedSize: 500000,
        },
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ImageProcessingQueueService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDatabase,
        },
        {
          provide: ImageProcessingService,
          useValue: mockImageProcessingService,
        },
      ],
    }).compile();

    service = module.get<ImageProcessingQueueService>(ImageProcessingQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addTask', () => {
    it('should add a new task to the queue', async () => {
      const fileId = 123;
      const processingConfig = { quality: 80 };
      const originalBuffer = Buffer.from('test image data');

      const result = await service.addTask(fileId, processingConfig, originalBuffer);

      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(result).toEqual({
        id: 1,
        fileId: 123,
        status: 'pending',
        priority: 0,
        processingConfig: { quality: 80 },
        originalBuffer: 'base64string',
        processedBuffer: null,
        errorMessage: null,
        attempts: 0,
        maxAttempts: 3,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        startedAt: null,
        completedAt: null,
      });
    });
  });

  describe('getTaskStatus', () => {
    it('should return task status', async () => {
      const mockTask = {
        id: 1,
        fileId: 123,
        status: 'pending',
        priority: 0,
        processingConfig: '{"quality":80}',
        originalBuffer: 'base64string',
        processedBuffer: null,
        errorMessage: null,
        attempts: 0,
        maxAttempts: 3,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        startedAt: null,
        completedAt: null,
      };

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTask]),
          }),
        }),
      });

      const result = await service.getTaskStatus(1);

      expect(result).toEqual({
        id: 1,
        fileId: 123,
        status: 'pending',
        priority: 0,
        processingConfig: { quality: 80 },
        originalBuffer: 'base64string',
        processedBuffer: null,
        errorMessage: null,
        attempts: 0,
        maxAttempts: 3,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        startedAt: null,
        completedAt: null,
      });
    });

    it('should return null if task not found', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getTaskStatus(999);

      expect(result).toBeNull();
    });
  });

  describe('getTasksByFileId', () => {
    it('should return tasks for a file', async () => {
      const mockTasks = [
        {
          id: 1,
          fileId: 123,
          status: 'completed',
          priority: 0,
          processingConfig: '{"quality":80}',
          originalBuffer: 'base64string',
          processedBuffer: 'processedbase64',
          errorMessage: null,
          attempts: 1,
          maxAttempts: 3,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:01:00.000Z',
          startedAt: '2024-01-01T00:00:30.000Z',
          completedAt: '2024-01-01T00:01:00.000Z',
        },
      ];

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockTasks),
          }),
        }),
      });

      const result = await service.getTasksByFileId(123);

      expect(result).toHaveLength(1);
      expect(result[0].fileId).toBe(123);
    });
  });
});
