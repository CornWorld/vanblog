import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import { Mock } from '@test/mock';

import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

describe('PipelineController', () => {
  let controller: PipelineController;
  let mockService: ReturnType<typeof Mock.pipelineService>;

  beforeEach(async () => {
    // ✅ 优化：使用新的扁平化 Mock API
    mockService = Mock.pipelineService();

    // ✅ 优化：使用新的扁平化 Mock API
    const mockPipeline = Mock.pipeline();
    const mockPipelineList = {
      items: [mockPipeline],
      total: 1,
    };
    // ✅ 优化：使用新的扁平化 Mock API
    const mockExecutionResult = Mock.pipelineExecutionResult();

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

  describe('getPipelines', () => {
    it('should return all pipelines', async () => {
      const handler = controller.getPipelines_tsrest();
      const result = await handler({} as never);

      expect(result).toEqual({ status: 200, body: [expect.any(Object)] });
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  describe('getPipelineConfig', () => {
    it('should return pipeline configuration', () => {
      const handler = controller.getPipelineConfig_tsrest();
      const result = handler({} as never);

      expect(result).toEqual({
        status: 200,
        body: { events: ['article|afterCreate', 'article|afterUpdate'] },
      });
      expect(mockService.getConfig).toHaveBeenCalled();
    });
  });

  describe('getPipeline', () => {
    it('should return a single pipeline by id', async () => {
      const handler = controller.getPipeline_tsrest();
      const result = await handler({ params: { id: '1' } } as never);

      expect(result).toEqual({ status: 200, body: expect.any(Object) });
      expect(mockService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      vi.mocked(mockService.findOne as any).mockRejectedValueOnce(
        new NotFoundException('Pipeline with ID 999 not found'),
      );

      const handler = controller.getPipeline_tsrest();
      await expect(handler({ params: { id: '999' } } as never)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPipeline', () => {
    it('should create a new pipeline', async () => {
      const createDto = {
        name: 'New Pipeline',
        eventName: 'article|afterCreate',
        script: 'console.log("new")',
        enabled: true,
        deps: [],
      };

      const handler = controller.createPipeline_tsrest();
      const result = await handler({ body: createDto } as never);

      expect(result).toEqual({ status: 201, body: expect.any(Object) });
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

      const handler = controller.createPipeline_tsrest();
      await expect(handler({ body: createDto } as never)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePipeline', () => {
    it('should update an existing pipeline', async () => {
      const updateDto = {
        name: 'Updated Pipeline',
        script: 'console.log("updated")',
      };

      const updatedPipeline = {
        ...Mock.pipeline(),
        ...updateDto,
      };

      vi.mocked(mockService.update as any).mockResolvedValueOnce(updatedPipeline);

      const handler = controller.updatePipeline_tsrest();
      const result = await handler({ params: { id: '1' }, body: updateDto } as never);

      expect(result.body.name).toBe('Updated Pipeline');
      expect(mockService.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      vi.mocked(mockService.update as any).mockRejectedValueOnce(
        new NotFoundException('Pipeline with ID 999 not found'),
      );

      const handler = controller.updatePipeline_tsrest();
      await expect(
        handler({ params: { id: '999' }, body: { name: 'Test' } } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePipeline', () => {
    it('should delete a pipeline', async () => {
      const handler = controller.deletePipeline_tsrest();
      const result = await handler({ params: { id: '1' } } as never);

      expect(result).toEqual({ status: 200, body: { success: true } });
      expect(mockService.remove).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      vi.mocked(mockService.remove as any).mockRejectedValueOnce(
        new NotFoundException('Pipeline with ID 999 not found'),
      );

      const handler = controller.deletePipeline_tsrest();
      await expect(handler({ params: { id: '999' } } as never)).rejects.toThrow(NotFoundException);
    });
  });

  describe('triggerPipeline', () => {
    it('should trigger a pipeline', async () => {
      const triggerDto = { title: 'Test Article' };

      const handler = controller.triggerPipeline_tsrest();
      const result = await handler({ params: { id: '1' }, body: triggerDto } as never);

      expect(result).toEqual({ status: 200, body: expect.any(Object) });
      expect(mockService.triggerById).toHaveBeenCalledWith(1, triggerDto);
    });

    it('should throw BadRequestException when pipeline is disabled', async () => {
      const triggerDto = { title: 'Test' };

      vi.mocked(mockService.triggerById as any).mockRejectedValueOnce(
        new BadRequestException('Pipeline 1 is disabled'),
      );

      const handler = controller.triggerPipeline_tsrest();
      await expect(handler({ params: { id: '1' }, body: triggerDto } as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      const triggerDto = {};

      vi.mocked(mockService.triggerById as any).mockRejectedValueOnce(
        new NotFoundException('Pipeline with ID 999 not found'),
      );

      const handler = controller.triggerPipeline_tsrest();
      await expect(handler({ params: { id: '999' }, body: triggerDto } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle empty input', async () => {
      const triggerDto = undefined;

      const handler = controller.triggerPipeline_tsrest();
      const result = await handler({ params: { id: '1' }, body: triggerDto } as never);

      expect(result).toEqual({ status: 200, body: expect.any(Object) });
      expect(mockService.triggerById).toHaveBeenCalledWith(1, triggerDto);
    });
  });
});
