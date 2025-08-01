import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './services/pipeline.service';
import type { CreatePipelineDto } from './dto';

describe('PipelineController', () => {
  let controller: PipelineController;
  let service: PipelineService;

  const mockPipelineService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    findByEvent: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    triggerById: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PipelineController],
      providers: [
        {
          provide: PipelineService,
          useValue: mockPipelineService,
        },
      ],
    }).compile();

    controller = module.get<PipelineController>(PipelineController);
    service = module.get<PipelineService>(PipelineService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a pipeline', async () => {
      const createDto: CreatePipelineDto = {
        name: 'Test Pipeline',
        eventName: 'login',
        script: 'console.log("test");',
      };

      const expectedResult = {
        id: 1,
        name: createDto.name,
        description: createDto.description,
        eventName: createDto.eventName,
        script: createDto.script,
        enabled: true,
        deps: '[]',
        eventType: 'system',
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPipelineService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should return an array of pipelines', async () => {
      const expectedResult = [
        {
          id: 1,
          name: 'Test Pipeline',
          eventName: 'login',
          script: 'console.log("test");',
          enabled: true,
          deps: '[]',
          eventType: 'system',
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPipelineService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return a single pipeline', async () => {
      const expectedResult = {
        id: 1,
        name: 'Test Pipeline',
        eventName: 'login',
        script: 'console.log("test");',
        enabled: true,
        deps: '[]',
        eventType: 'system',
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPipelineService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(1);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('trigger', () => {
    it('should trigger a pipeline', async () => {
      const expectedResult = {
        logs: ['Pipeline executed'],
        output: { success: true },
        status: 'success' as const,
      };

      mockPipelineService.triggerById.mockResolvedValue(expectedResult);

      const result = await controller.trigger(1, { test: 'data' });

      expect(service.triggerById).toHaveBeenCalledWith(1, { test: 'data' });
      expect(result).toEqual(expectedResult);
    });
  });
});
