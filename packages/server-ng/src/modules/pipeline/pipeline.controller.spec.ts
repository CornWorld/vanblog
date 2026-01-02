import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { MockUtils } from '../../../test/mock-utils';

describe('PipelineController', () => {
  let controller: PipelineController;
  let mockService: ReturnType<typeof MockUtils.services.createPipelineServiceMock>;

  beforeEach(async () => {
    // 使用 MockUtils 创建 PipelineService Mock
    mockService = MockUtils.services.createPipelineServiceMock();

    const mockPipeline = MockUtils.testData.createPipeline();
    const mockPipelineList = {
      items: [mockPipeline],
      total: 1,
    };
    const mockExecutionResult = MockUtils.testData.createPipelineExecutionResult();

    // 配置 mock 返回值
    vi.mocked(mockService.findAll as any).mockResolvedValue(mockPipelineList);
    vi.mocked(mockService.findOne as any).mockResolvedValue(mockPipeline);
    vi.mocked(mockService.create as any).mockResolvedValue(mockPipeline);
    vi.mocked(mockService.update as any).mockResolvedValue(mockPipeline);
    vi.mocked(mockService.remove as any).mockResolvedValue(undefined);
    vi.mocked(mockService.getConfig as any).mockReturnValue({
      events: ['article|afterCreate', 'article|afterUpdate'],
    });
    vi.mocked(mockService.triggerById as any).mockResolvedValue(mockExecutionResult);
    vi.mocked(mockService.dispatchEvent as any).mockResolvedValue([mockExecutionResult]);

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

      expect(result.items).toBeDefined();
      expect(result.total).toBeDefined();
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

      expect(result).toBeDefined();
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
        deps: [],
      };

      const result = await controller.create(createDto);

      expect(result).toBeDefined();
      expect(mockService.create).toHaveBeenCalledWith(createDto);
    });

    it('should throw BadRequestException for invalid event name', async () => {
      const createDto = {
        name: 'Invalid Pipeline',
        eventName: '',
        script: 'console.log("test")',
        enabled: true,
        deps: [],
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
        ...MockUtils.testData.createPipeline(),
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

      expect(result).toBeDefined();
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

      expect(result).toBeDefined();
      expect(mockService.triggerById).toHaveBeenCalledWith(1, undefined);
    });
  });
});
