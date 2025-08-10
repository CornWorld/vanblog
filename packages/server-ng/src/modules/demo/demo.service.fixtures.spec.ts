import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, vi } from 'vitest';

import { configTest, DatabaseMockBuilder } from '../../../test/vitest-fixtures.test';
import { DATABASE_CONNECTION } from '../../database';

import { DemoService } from './demo.service';

describe('DemoService with Vitest Fixtures', () => {
  let service: DemoService;
  let module: TestingModule;
  let configService: ConfigService;
  let mockDatabase: DatabaseMockBuilder;

  const mockConfigService = {
    get: vi.fn(),
  };

  beforeEach(async () => {
    mockDatabase = new DatabaseMockBuilder();

    module = await Test.createTestingModule({
      providers: [
        DemoService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDatabase.db,
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

  configTest('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isDemoModeEnabled', () => {
    configTest('should return true when demo mode is enabled', () => {
      mockConfigService.get.mockReturnValueOnce(true);
      const newService = new DemoService(mockDatabase.db as any, configService);
      expect(newService.isDemoModeEnabled()).toBe(true);
    });

    configTest('should return false when demo mode is disabled', () => {
      mockConfigService.get.mockReturnValueOnce(false);
      const newService = new DemoService(mockDatabase.db as any, configService);
      expect(newService.isDemoModeEnabled()).toBe(false);
    });
  });

  describe('createSnapshot', () => {
    configTest('should create a snapshot successfully', async () => {
      await service.createSnapshot();
      expect(mockDatabase.db.select).toHaveBeenCalled();
    });
  });

  describe('manualRestore', () => {
    configTest('should restore demo data when demo mode is enabled', async () => {
      mockConfigService.get.mockReturnValue(true);
      const newService = new DemoService(
        mockDatabase.db as any,
        mockConfigService as unknown as ConfigService,
      );

      const result = await newService.manualRestore();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Demo data restored successfully');
    });

    configTest('should fail when demo mode is disabled', async () => {
      mockConfigService.get.mockReturnValue(false);
      const newService = new DemoService(
        mockDatabase.db as any,
        mockConfigService as unknown as ConfigService,
      );

      const result = await newService.manualRestore();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Demo mode is not enabled');
    });
  });

  describe('getSnapshotInfo', () => {
    configTest('should return snapshot info', () => {
      const result = service.getSnapshotInfo();

      expect(result).toBeDefined();
      expect(typeof result.hasSnapshot).toBe('boolean');
    });
  });
});
