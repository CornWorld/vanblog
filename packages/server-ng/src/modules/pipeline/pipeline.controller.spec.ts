import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

describe('PipelineController', () => {
  let controller: PipelineController;
  let mockService: Partial<PipelineService>;

  const mockPipeline = {
    id: 1,
    name: 'Test Pipeline',
    eventName: 'article|afterCreate',
    script: 'console.log("test")',
    enabled: true,
    deleted: false,
    status: 'idle',
    lastRun: null,
    lastStatus: null,
    lastError: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockPipelineList = {
    items: [mockPipeline],
    total: 1,
  };

  const mockExecutionResult = {
    status: 'success' as const,
    logs: ['Pipeline executed'],
    output: { result: 'test' },
  };

  beforeEach(async () => {
    mockService = {
      findAll: vi.fn().mockResolvedValue(mockPipelineList),
      findOne: vi.fn().mockResolvedValue(mockPipeline),
      create: vi.fn().mockResolvedValue(mockPipeline),
      update: vi.fn().mockResolvedValue(mockPipeline),
      remove: vi.fn().mockResolvedValue(undefined),
      getConfig: vi
        .fn()
        .mockResolvedValue({ events: ['article|afterCreate', 'article|afterUpdate'] }),
      triggerById: vi.fn().mockResolvedValue(mockExecutionResult),
      dispatchEvent: vi.fn().mockResolvedValue([mockExecutionResult]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PipelineController],
      providers: [
        {
          provide: PipelineService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<PipelineController>(PipelineController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all pipelines', async () => {
      const result = await controller.findAll();

      expect(result).toEqual(mockPipelineList);
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return pipeline configuration', () => {
      const result = controller.getConfig();

      expect(result.events).toBeDefined();
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
      expect(mockService.getConfig).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single pipeline by id', async () => {
      const result = await controller.findOne(1);

      expect(result).toEqual(mockPipeline);
      expect(mockService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      vi.mocked(mockService.findOne as any).mockRejectedValueOnce(
        new NotFoundException('Pipeline with ID 999 not found'),
      );

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new pipeline', async () => {
      const createDto = {
        name: 'New Pipeline',
        eventName: 'article|afterCreate',
        script: 'console.log("new")',
        enabled: true,
      };

      const result = await controller.create(createDto);

      expect(result).toEqual(mockPipeline);
      expect(mockService.create).toHaveBeenCalledWith(createDto);
    });

    it('should throw BadRequestException for invalid event name', async () => {
      const createDto = {
        name: 'Invalid Pipeline',
        eventName: '',
        script: 'console.log("test")',
        enabled: true,
      };

      vi.mocked(mockService.create as any).mockRejectedValueOnce(
        new BadRequestException('Event name is required'),
      );

      await expect(controller.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update an existing pipeline', async () => {
      const updateDto = {
        name: 'Updated Pipeline',
        script: 'console.log("updated")',
      };

      const updatedPipeline = {
        ...mockPipeline,
        ...updateDto,
      };

      vi.mocked(mockService.update as any).mockResolvedValueOnce(updatedPipeline);

      const result = await controller.update(1, updateDto);

      expect(result.name).toBe('Updated Pipeline');
      expect(mockService.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      vi.mocked(mockService.update as any).mockRejectedValueOnce(
        new NotFoundException('Pipeline with ID 999 not found'),
      );

      await expect(controller.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a pipeline', async () => {
      const result = await controller.remove(1);

      expect(result).toEqual({ success: true });
      expect(mockService.remove).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      vi.mocked(mockService.remove as any).mockRejectedValueOnce(
        new NotFoundException('Pipeline with ID 999 not found'),
      );

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('trigger', () => {
    it('should trigger a pipeline', async () => {
      const triggerDto = {
        input: { title: 'Test Article' },
      };

      const result = await controller.trigger(1, triggerDto);

      expect(result).toEqual(mockExecutionResult);
      expect(mockService.triggerById).toHaveBeenCalledWith(1, triggerDto.input);
    });

    it('should throw BadRequestException when pipeline is disabled', async () => {
      const triggerDto = {
        input: { title: 'Test' },
      };

      vi.mocked(mockService.triggerById as any).mockRejectedValueOnce(
        new BadRequestException('Pipeline 1 is disabled'),
      );

      await expect(controller.trigger(1, triggerDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      const triggerDto = {
        input: {},
      };

      vi.mocked(mockService.triggerById as any).mockRejectedValueOnce(
        new NotFoundException('Pipeline with ID 999 not found'),
      );

      await expect(controller.trigger(999, triggerDto)).rejects.toThrow(NotFoundException);
    });

    it('should handle empty input', async () => {
      const triggerDto = {
        input: undefined,
      };

      const result = await controller.trigger(1, triggerDto);

      expect(result).toEqual(mockExecutionResult);
      expect(mockService.triggerById).toHaveBeenCalledWith(1, undefined);
    });
  });
});
