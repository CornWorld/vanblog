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
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup mock database chain
    mockDatabase.select.mockReturnValue(mockQuery);
    mockDatabase.from.mockReturnValue(mockDatabase);
    mockDatabase.where.mockResolvedValue([]);
    mockDatabase.insert.mockReturnValue(mockDatabase);
    mockDatabase.values.mockReturnValue(mockDatabase);
    mockDatabase.delete.mockReturnValue(mockDatabase);
    mockDatabase.returning.mockResolvedValue([]);

    // Default: demo mode disabled
    mockConfigService.get.mockReturnValue(false);

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

  describe('onModuleInit', () => {
    it('should create snapshot when demo mode is enabled and not in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockConfigService.get.mockReturnValue(true);
      const newService = new DemoService(
        mockDatabase as unknown as Database,
        mockConfigService as unknown as ConfigService,
      );

      // Setup select to return mock data
      const mockSelectQuery = {
        from: vi.fn().mockResolvedValue([
          { id: 1, title: 'Test Article' },
          { id: 2, title: 'Another Article' },
        ]),
      };
      mockDatabase.select.mockReturnValue(mockSelectQuery);

      await newService.onModuleInit();

      expect(mockDatabase.select).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should skip snapshot creation in test environment even when demo mode is enabled', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      mockConfigService.get.mockReturnValue(true);
      const newService = new DemoService(
        mockDatabase as unknown as Database,
        mockConfigService as unknown as ConfigService,
      );

      const selectSpy = vi.spyOn(mockDatabase, 'select');

      await newService.onModuleInit();

      expect(selectSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not create snapshot when demo mode is disabled', async () => {
      mockConfigService.get.mockReturnValue(false);
      const newService = new DemoService(
        mockDatabase as unknown as Database,
        mockConfigService as unknown as ConfigService,
      );

      const selectSpy = vi.spyOn(mockDatabase, 'select');

      await newService.onModuleInit();

      expect(selectSpy).not.toHaveBeenCalled();
    });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot successfully', async () => {
      // Setup mock data for all tables
      const mockSelectQuery = {
        from: vi.fn().mockResolvedValue([
          { id: 1, title: 'Test Article' },
          { id: 2, title: 'Another Article' },
        ]),
      };
      mockDatabase.select.mockReturnValue(mockSelectQuery);

      await service.createSnapshot();

      expect(mockDatabase.select).toHaveBeenCalled();
      expect(mockSelectQuery.from).toHaveBeenCalledTimes(7); // 7 tables

      const snapshotInfo = service.getSnapshotInfo();
      expect(snapshotInfo.hasSnapshot).toBe(true);
      expect(snapshotInfo.articlesCount).toBe(2);
    });

    it('should handle errors during snapshot creation', async () => {
      const errorMessage = 'Database error';
      mockDatabase.select.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await expect(service.createSnapshot()).rejects.toThrow(errorMessage);
    });
  });

  describe('restoreFromSnapshot', () => {
    it('should warn and return early when no snapshot is available', async () => {
      await service.restoreFromSnapshot();

      // Should not attempt to delete or insert anything
      expect(mockDatabase.delete).not.toHaveBeenCalled();
      expect(mockDatabase.insert).not.toHaveBeenCalled();
    });

    it('should restore all data from snapshot successfully', async () => {
      // Create a snapshot first
      const mockSelectQuery = {
        from: vi.fn().mockResolvedValue([
          { id: 1, name: 'Category 1' },
          { id: 2, name: 'Category 2' },
        ]),
      };
      mockDatabase.select.mockReturnValue(mockSelectQuery);

      await service.createSnapshot();

      // Reset mocks for restore operation
      vi.clearAllMocks();

      // Setup mocks for restore
      mockDatabase.delete.mockReturnValue(mockDatabase);
      mockDatabase.insert.mockReturnValue(mockDatabase);
      mockDatabase.values.mockResolvedValue([]);

      await service.restoreFromSnapshot();

      // Should delete all 8 tables (analytics, staticFiles, customPages, articles, drafts, categories, tags, siteMeta)
      expect(mockDatabase.delete).toHaveBeenCalledTimes(8);

      // Should insert data for tables with data
      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(mockDatabase.values).toHaveBeenCalled();
    });

    it('should skip insert for tables with no data', async () => {
      // Create a snapshot with empty arrays
      const mockSelectQuery = {
        from: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select.mockReturnValue(mockSelectQuery);

      await service.createSnapshot();

      vi.clearAllMocks();

      mockDatabase.delete.mockReturnValue(mockDatabase);

      await service.restoreFromSnapshot();

      // Should delete but not insert
      expect(mockDatabase.delete).toHaveBeenCalled();
      expect(mockDatabase.insert).not.toHaveBeenCalled();
    });

    it('should handle errors during restoration', async () => {
      // Create a snapshot first
      const mockSelectQuery = {
        from: vi.fn().mockResolvedValue([{ id: 1 }]),
      };
      mockDatabase.select.mockReturnValue(mockSelectQuery);

      await service.createSnapshot();

      vi.clearAllMocks();

      const errorMessage = 'Restore failed';
      mockDatabase.delete.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await expect(service.restoreFromSnapshot()).rejects.toThrow(errorMessage);
    });
  });

  describe('manualRestore', () => {
    it('should restore demo data when demo mode is enabled', async () => {
      mockConfigService.get.mockReturnValue(true);
      const newService = new DemoService(
        mockDatabase as unknown as Database,
        mockConfigService as unknown as ConfigService,
      );

      // Create a snapshot first
      const mockSelectQuery = {
        from: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select.mockReturnValue(mockSelectQuery);
      await newService.createSnapshot();

      vi.clearAllMocks();

      mockDatabase.delete.mockReturnValue(mockDatabase);

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

    it('should return error message when restoration fails', async () => {
      mockConfigService.get.mockReturnValue(true);
      const newService = new DemoService(
        mockDatabase as unknown as Database,
        mockConfigService as unknown as ConfigService,
      );

      // Create a snapshot
      const mockSelectQuery = {
        from: vi.fn().mockResolvedValue([{ id: 1 }]),
      };
      mockDatabase.select.mockReturnValue(mockSelectQuery);
      await newService.createSnapshot();

      vi.clearAllMocks();

      const errorMessage = 'Database connection lost';
      mockDatabase.delete.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await newService.manualRestore();

      expect(result.success).toBe(false);
      expect(result.message).toBe(`Failed to restore demo data: ${errorMessage}`);
    });

    it('should handle non-Error exceptions', async () => {
      mockConfigService.get.mockReturnValue(true);
      const newService = new DemoService(
        mockDatabase as unknown as Database,
        mockConfigService as unknown as ConfigService,
      );

      // Create a snapshot
      const mockSelectQuery = {
        from: vi.fn().mockResolvedValue([{ id: 1 }]),
      };
      mockDatabase.select.mockReturnValue(mockSelectQuery);
      await newService.createSnapshot();

      vi.clearAllMocks();

      mockDatabase.delete.mockImplementation(() => {
        throw new Error('String error');
      });

      const result = await newService.manualRestore();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to restore demo data: String error');
    });
  });

  describe('scheduledRestore', () => {
    it('should restore data when demo mode is enabled', async () => {
      mockConfigService.get.mockReturnValue(true);
      const newService = new DemoService(
        mockDatabase as unknown as Database,
        mockConfigService as unknown as ConfigService,
      );

      // Create a snapshot first
      const mockSelectQuery = {
        from: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select.mockReturnValue(mockSelectQuery);
      await newService.createSnapshot();

      vi.clearAllMocks();

      mockDatabase.delete.mockReturnValue(mockDatabase);

      await newService.scheduledRestore();

      expect(mockDatabase.delete).toHaveBeenCalled();
    });

    it('should do nothing when demo mode is disabled', async () => {
      mockConfigService.get.mockReturnValue(false);
      const newService = new DemoService(
        mockDatabase as unknown as Database,
        mockConfigService as unknown as ConfigService,
      );

      await newService.scheduledRestore();

      expect(mockDatabase.delete).not.toHaveBeenCalled();
    });
  });

  describe('getSnapshotInfo', () => {
    it('should return hasSnapshot false when no snapshot exists', () => {
      const result = service.getSnapshotInfo();

      expect(result).toBeDefined();
      expect(result.hasSnapshot).toBe(false);
      expect(result.timestamp).toBeUndefined();
      expect(result.articlesCount).toBeUndefined();
      expect(result.draftsCount).toBeUndefined();
    });

    it('should return snapshot info when snapshot exists', async () => {
      const mockSelectQuery = {
        from: vi.fn().mockResolvedValue([
          { id: 1, title: 'Article 1' },
          { id: 2, title: 'Article 2' },
          { id: 3, title: 'Article 3' },
        ]),
      };
      mockDatabase.select.mockReturnValue(mockSelectQuery);

      await service.createSnapshot();

      const result = service.getSnapshotInfo();

      expect(result.hasSnapshot).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
      expect(result.articlesCount).toBe(3);
      expect(result.draftsCount).toBe(3);
    });
  });
});
