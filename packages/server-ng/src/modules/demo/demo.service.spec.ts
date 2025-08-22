import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { DATABASE_CONNECTION, type Database } from '../../database';

import { DemoService } from './demo.service';

const mockDatabase = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  delete: vi.fn(),
  returning: vi.fn(),
};

// Set up mock database chain calls
const mockQuery = {
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
};
mockDatabase.select.mockReturnValue(mockQuery);
mockDatabase.from.mockReturnValue(mockDatabase);
mockDatabase.where.mockResolvedValue([{ count: 5 }]);
mockDatabase.insert.mockReturnValue(mockDatabase);
mockDatabase.values.mockReturnValue(mockDatabase);
mockDatabase.delete.mockReturnValue(mockDatabase);
mockDatabase.returning.mockResolvedValue([]);

const mockConfigService = {
  get: vi.fn(),
};

describe('DemoService', () => {
  let service: DemoService;
  let module: TestingModule;
  let configService: ConfigService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        DemoService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDatabase,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DemoService>(DemoService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isDemoModeEnabled', () => {
    it('should return true when demo mode is enabled', () => {
      mockConfigService.get.mockReturnValueOnce(true);
      const newService = new DemoService(mockDatabase as unknown as Database, configService);
      expect(newService.isDemoModeEnabled()).toBe(true);
    });

    it('should return false when demo mode is disabled', () => {
      mockConfigService.get.mockReturnValueOnce(false);
      const newService = new DemoService(mockDatabase as unknown as Database, configService);
      expect(newService.isDemoModeEnabled()).toBe(false);
    });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot successfully', async () => {
      await service.createSnapshot();
      expect(mockDatabase.select).toHaveBeenCalled();
    });
  });

  describe('manualRestore', () => {
    it('should restore demo data when demo mode is enabled', async () => {
      mockConfigService.get.mockReturnValue(true);
      const newService = new DemoService(
        mockDatabase as unknown as Database,
        mockConfigService as unknown as ConfigService,
      );

      const result = await newService.manualRestore();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Demo data restored successfully');
    });

    it('should fail when demo mode is disabled', async () => {
      mockConfigService.get.mockReturnValue(false);
      const newService = new DemoService(
        mockDatabase as unknown as Database,
        mockConfigService as unknown as ConfigService,
      );

      const result = await newService.manualRestore();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Demo mode is not enabled');
    });
  });

  describe('getSnapshotInfo', () => {
    it('should return snapshot info', () => {
      const result = service.getSnapshotInfo();

      expect(result).toBeDefined();
      expect(typeof result.hasSnapshot).toBe('boolean');
    });
  });
});
