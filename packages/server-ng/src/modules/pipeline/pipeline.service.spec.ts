import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, beforeEach, it, expect, vi, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';

import { Mock } from '@test/mock';
import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';
import { PipelineService } from './pipeline.service';

// Mock entire file system module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  fork: vi.fn(),
}));

// Mock drizzle schemas
vi.mock('@vanblog/shared/drizzle', () => ({
  pipelines: {
    id: Symbol('id'),
    name: Symbol('name'),
    eventName: Symbol('eventName'),
    script: Symbol('script'),
    enabled: Symbol('enabled'),
    deleted: Symbol('deleted'),
    status: Symbol('status'),
    lastRun: Symbol('lastRun'),
    lastStatus: Symbol('lastStatus'),
    lastError: Symbol('lastError'),
    createdAt: Symbol('createdAt'),
    updatedAt: Symbol('updatedAt'),
  },
}));

describe('PipelineService', () => {
  let service: PipelineService;
  let databaseMock: any;
  let mockConfigService: any;
  let mockHookService: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock file system
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(mkdirSync).mockReturnValue(undefined as any);

    // 使用 MockUtils 创建数据库 Mock
    databaseMock = Mock.db().build();

    // 使用 MockUtils 创建配置服务 Mock
    mockConfigService = Mock.config({
      'pipeline.runnerPath': '/tmp/test-pipelines',
    });

    // 使用 MockUtils 创建钩子服务 Mock
    mockHookService = Mock.hook();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        {
          provide: DATABASE_CONNECTION,
          useValue: databaseMock,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
      ],
    }).compile();

    service = module.get<PipelineService>(PipelineService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should ensure runner directory exists when directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await Test.createTestingModule({
        providers: [
          PipelineService,
          {
            provide: DATABASE_CONNECTION,
            useValue: databaseMock,
          },
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: HookService,
            useValue: mockHookService,
          },
        ],
      }).compile();

      expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('findAll', () => {
    it('should return all non-deleted pipelines', async () => {
      const mockPipelines = [
        Mock.createPipeline({
          id: 1,
          name: 'Pipeline 1',
          eventName: 'article|afterCreate',
        }),
        Mock.createPipeline({
          id: 2,
          name: 'Pipeline 2',
          eventName: 'article|afterUpdate',
          enabled: false,
        }),
      ];

      // 使用 DatabaseMockBuilder 设置查询结果
      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockPipelines),
          }),
        }),
      });

      const result = await service.findAll();

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(databaseMock.select).toHaveBeenCalled();
    });

    it('should return empty list when no pipelines exist', async () => {
      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.findAll();

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return pipeline by id', async () => {
      const mockPipeline = Mock.createPipeline({ id: 1 });

      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockPipeline]),
        }),
      });

      const result = await service.findOne(1);

      expect(result).toEqual(mockPipeline);
      expect(databaseMock.select).toHaveBeenCalled();
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('Pipeline with ID 999 not found');
    });
  });

  describe('findByEventName', () => {
    it('should return enabled pipelines for event', async () => {
      const mockPipelines = [
        Mock.createPipeline({
          id: 1,
          name: 'Pipeline 1',
          eventName: 'article|afterCreate',
        }),
      ];

      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockPipelines),
        }),
      });

      const result = await service.findByEventName('article|afterCreate');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pipeline 1');
    });

    it('should return empty array when no pipelines match event', async () => {
      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.findByEventName('non-existent-event');

      expect(result).toHaveLength(0);
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

      const mockCreated = Mock.createPipeline({ ...createDto, id: 1 });

      databaseMock.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCreated]),
        }),
      });

      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCreated);
      expect(databaseMock.insert).toHaveBeenCalled();
    });

    it('should set default script when script is empty', async () => {
      const createDto = {
        name: 'Empty Script Pipeline',
        eventName: 'article|afterCreate',
        script: '',
        enabled: true,
        deps: [],
      };

      const defaultScript = `
// Async task - use await at top level
// Access input data via 'input' variable
// Modify input directly - it will be returned after script execution

console.log('Pipeline executed with input:', input);
`;

      const mockCreated = Mock.createPipeline({
        id: 2,
        name: createDto.name,
        eventName: createDto.eventName,
        script: defaultScript,
        enabled: true,
      });

      databaseMock.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCreated]),
        }),
      });

      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const result = await service.create(createDto);

      expect(result.script).toContain('// Async task');
      expect(result.script).toContain('console.log');
    });

    it('should throw error when event name is invalid', async () => {
      const createDto = {
        name: 'Invalid Event',
        eventName: '',
        script: 'console.log("test")',
        enabled: true,
        deps: [],
      };

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createDto)).rejects.toThrow('Event name is required');
    });
  });

  describe('update', () => {
    it('should update an existing pipeline', async () => {
      const existingPipeline = Mock.createPipeline({ id: 1 });

      const updateDto = {
        name: 'Updated Name',
        script: 'new script',
      };

      const updatedPipeline = {
        ...existingPipeline,
        ...updateDto,
      };

      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingPipeline]),
        }),
      });

      databaseMock.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedPipeline]),
          }),
        }),
      });

      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const result = await service.update(1, updateDto);

      expect(result.name).toBe('Updated Name');
      expect(result.script).toBe('new script');
      expect(databaseMock.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });

    it('should validate event name when provided in update', async () => {
      const existingPipeline = Mock.createPipeline({ id: 1 });

      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingPipeline]),
        }),
      });

      const updateDto = {
        eventName: '   ', // whitespace only
      };

      await expect(service.update(1, updateDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft delete a pipeline', async () => {
      const existingPipeline = Mock.createPipeline({ id: 1 });

      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingPipeline]),
        }),
      });

      databaseMock.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });

      // Mock rmSync to avoid actual file deletion
      vi.mocked(rmSync).mockReturnValue(undefined);

      await service.remove(1);

      expect(databaseMock.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConfig', () => {
    it('should return available event names', () => {
      const result = service.getConfig();

      expect(result.events).toBeDefined();
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events).toContain('article|beforeCreate');
      expect(result.events).toContain('article|afterCreate');
    });
  });

  describe('triggerById', () => {
    it('should throw BadRequestException when pipeline is disabled', async () => {
      const disabledPipeline = Mock.createPipeline({
        id: 1,
        enabled: false,
      });

      databaseMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([disabledPipeline]),
        }),
      });

      await expect(service.triggerById(1, {})).rejects.toThrow(BadRequestException);
      await expect(service.triggerById(1, {})).rejects.toThrow('Pipeline 1 is disabled');
    });
  });

  describe('dispatchEvent', () => {
    it('should be defined as a method', () => {
      expect(service.dispatchEvent).toBeDefined();
      expect(typeof service.dispatchEvent).toBe('function');
    });
  });
});
