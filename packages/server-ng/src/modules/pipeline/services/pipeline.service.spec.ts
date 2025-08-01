import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { PipelineService } from './pipeline.service';
import { DATABASE_CONNECTION } from '../../../database';
import { NotFoundException } from '@nestjs/common';

type MockDatabase = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

// Mock file system operations
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  fork: vi.fn(),
  spawnSync: vi.fn().mockReturnValue({ status: 0 }),
}));

describe('PipelineService', () => {
  let service: PipelineService;
  let mockDatabase: MockDatabase;

  const mockDatabaseConnection = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDatabaseConnection,
        },
      ],
    }).compile();

    service = module.get<PipelineService>(PipelineService);
    mockDatabase = module.get(DATABASE_CONNECTION);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException for invalid event name', async () => {
      const createDto = {
        name: 'Test Pipeline',
        eventName: 'invalid-event',
        script: 'console.log("test");',
        deps: [],
        eventType: 'system' as const,
        description: 'Test description',
        enabled: true,
      };

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when pipeline not found', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });
});
