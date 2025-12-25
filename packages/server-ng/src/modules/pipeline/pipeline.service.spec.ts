import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, beforeEach, it, expect, vi, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';

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
  let mockDb: any;
  let mockConfigService: any;
  let mockHookService: any;

  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn(),
  };

  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };

  const mockUpdateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock file system
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(mkdirSync).mockReturnValue(undefined as any);

    mockDb = {
      select: vi.fn().mockReturnValue(mockSelectChain),
      insert: vi.fn().mockReturnValue(mockInsertChain),
      update: vi.fn().mockReturnValue(mockUpdateChain),
      delete: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'pipeline.runnerPath') {
          return defaultValue || '/tmp/test-pipelines';
        }
        return defaultValue;
      }),
    };

    mockHookService = {
      applyFilters: vi.fn(),
      doAction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
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

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PipelineService,
          {
            provide: DATABASE_CONNECTION,
            useValue: mockDb,
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

      const newService = module.get<PipelineService>(PipelineService);

      expect(newService).toBeDefined();
      expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('findAll', () => {
    it('should return all non-deleted pipelines', async () => {
      const mockPipelines = [
        {
          id: 1,
          name: 'Pipeline 1',
          eventName: 'article|afterCreate',
          script: 'console.log("test")',
          enabled: true,
          deleted: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'Pipeline 2',
          eventName: 'article|afterUpdate',
          script: 'console.log("test2")',
          enabled: false,
          deleted: false,
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];

      mockSelectChain.orderBy.mockResolvedValue(mockPipelines);

      const result = await service.findAll();

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty list when no pipelines exist', async () => {
      mockSelectChain.orderBy.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return pipeline by id', async () => {
      const mockPipeline = {
        id: 1,
        name: 'Test Pipeline',
        eventName: 'article|afterCreate',
        script: 'console.log("test")',
        enabled: true,
        deleted: false,
      };

      mockSelectChain.where.mockResolvedValue([mockPipeline]);

      const result = await service.findOne(1);

      expect(result).toEqual(mockPipeline);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      mockSelectChain.where.mockResolvedValue([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('Pipeline with ID 999 not found');
    });
  });

  describe('findByEventName', () => {
    it('should return enabled pipelines for event', async () => {
      const mockPipelines = [
        {
          id: 1,
          name: 'Pipeline 1',
          eventName: 'article|afterCreate',
          enabled: true,
          deleted: false,
        },
      ];

      mockSelectChain.where.mockResolvedValue(mockPipelines);

      const result = await service.findByEventName('article|afterCreate');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pipeline 1');
    });

    it('should return empty array when no pipelines match event', async () => {
      mockSelectChain.where.mockResolvedValue([]);

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
      };

      const mockCreated = {
        id: 1,
        ...createDto,
        deleted: false,
        status: 'idle',
        lastRun: null,
        lastStatus: null,
        lastError: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockInsertChain.returning.mockResolvedValue([mockCreated]);

      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCreated);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should set default script when script is empty', async () => {
      const createDto = {
        name: 'Empty Script Pipeline',
        eventName: 'article|afterCreate',
        script: '',
        enabled: true,
      };

      const mockCreated = {
        id: 2,
        name: createDto.name,
        eventName: createDto.eventName,
        script: `
// Async task - use await at top level
// Access input data via 'input' variable
// Modify input directly - it will be returned after script execution

console.log('Pipeline executed with input:', input);
`,
        enabled: true,
        deleted: false,
        status: 'idle',
        lastRun: null,
        lastStatus: null,
        lastError: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockInsertChain.returning.mockResolvedValue([mockCreated]);

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
      };

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createDto)).rejects.toThrow('Event name is required');
    });
  });

  describe('update', () => {
    it('should update an existing pipeline', async () => {
      const existingPipeline = {
        id: 1,
        name: 'Old Name',
        eventName: 'article|afterCreate',
        script: 'old script',
        enabled: true,
        deleted: false,
      };

      const updateDto = {
        name: 'Updated Name',
        script: 'new script',
      };

      const updatedPipeline = {
        ...existingPipeline,
        name: 'Updated Name',
        script: 'new script',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockSelectChain.where.mockResolvedValue([existingPipeline]);
      mockUpdateChain.returning.mockResolvedValue([updatedPipeline]);

      vi.mocked(writeFileSync).mockReturnValue(undefined);

      const result = await service.update(1, updateDto);

      expect(result.name).toBe('Updated Name');
      expect(result.script).toBe('new script');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      mockSelectChain.where.mockResolvedValue([]);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });

    it('should validate event name when provided in update', async () => {
      const existingPipeline = {
        id: 1,
        name: 'Pipeline',
        eventName: 'article|afterCreate',
        script: 'console.log("test")',
        enabled: true,
        deleted: false,
      };

      mockSelectChain.where.mockResolvedValue([existingPipeline]);

      const updateDto = {
        eventName: '   ', // whitespace only
      };

      await expect(service.update(1, updateDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft delete a pipeline', async () => {
      const existingPipeline = {
        id: 1,
        name: 'To Delete',
        eventName: 'article|afterCreate',
        enabled: true,
        deleted: false,
      };

      mockSelectChain.where.mockResolvedValue([existingPipeline]);
      mockUpdateChain.returning.mockResolvedValue(undefined);

      // Mock rmSync to avoid actual file deletion
      vi.mocked(rmSync).mockReturnValue(undefined);

      await service.remove(1);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      mockSelectChain.where.mockResolvedValue([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConfig', () => {
    it('should return available event names', async () => {
      const result = await service.getConfig();

      expect(result.events).toBeDefined();
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events).toContain('article|beforeCreate');
      expect(result.events).toContain('article|afterCreate');
    });
  });

  describe('triggerById', () => {
    it('should throw BadRequestException when pipeline is disabled', async () => {
      const disabledPipeline = {
        id: 1,
        name: 'Disabled',
        eventName: 'article|afterCreate',
        script: 'console.log("test")',
        enabled: false,
        deleted: false,
      };

      mockSelectChain.where.mockResolvedValue([disabledPipeline]);

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
