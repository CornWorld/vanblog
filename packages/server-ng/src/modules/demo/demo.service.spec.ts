import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { DatabaseMockBuilder } from '@test/mock';

import { DemoService } from './demo.service';

describe('DemoService', () => {
  let service: DemoService;
  let module: TestingModule;
  let dbMock: DatabaseMockBuilder;
  let configService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // ✅ 优化：使用更简洁的 Mock API
    dbMock = new DatabaseMockBuilder();
    dbMock.setQueryResult([]);

    // ✅ 优化：使用 Mock.config() 简化配置 Mock
    configService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'DEMO_MODE') return defaultValue ?? false;
        return defaultValue;
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        DemoService,
        {
          provide: DATABASE_CONNECTION,
          useValue: dbMock.build(),
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<DemoService>(DemoService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isDemoModeEnabled', () => {
    it('should return true when demo mode is enabled', () => {
      const configMock = {
        get: vi.fn().mockReturnValue(true),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );
      expect(newService.isDemoModeEnabled()).toBe(true);
    });

    it('should return false when demo mode is disabled', () => {
      const configMock = {
        get: vi.fn().mockReturnValue(false),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );
      expect(newService.isDemoModeEnabled()).toBe(false);
    });
  });

  describe('onModuleInit', () => {
    it('should create snapshot when demo mode is enabled and not in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const configMock = {
        get: vi.fn().mockReturnValue(true),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      dbMockForTest.setQueryResult([
        { id: 1, title: 'Test Article' },
        { id: 2, title: 'Another Article' },
      ]);
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );

      await newService.onModuleInit();

      expect(dbMockForTest.db.select).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should skip snapshot creation in test environment even when demo mode is enabled', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const configMock = {
        get: vi.fn().mockReturnValue(true),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      const selectSpy = vi.spyOn(dbMockForTest.db, 'select');
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );

      await newService.onModuleInit();

      expect(selectSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not create snapshot when demo mode is disabled', async () => {
      const configMock = {
        get: vi.fn().mockReturnValue(false),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      const selectSpy = vi.spyOn(dbMockForTest.db, 'select');
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );

      await newService.onModuleInit();

      expect(selectSpy).not.toHaveBeenCalled();
    });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot successfully', async () => {
      dbMock.setQueryResult([
        { id: 1, title: 'Test Article' },
        { id: 2, title: 'Another Article' },
      ]);

      await service.createSnapshot();

      expect(dbMock.db.select).toHaveBeenCalled();

      const snapshotInfo = service.getSnapshotInfo();
      expect(snapshotInfo.hasSnapshot).toBe(true);
      expect(snapshotInfo.timestamp).toBeDefined();
    });

    it('should handle errors during snapshot creation', async () => {
      dbMock.db.select.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.createSnapshot()).rejects.toThrow('Database error');
    });
  });

  describe('restoreFromSnapshot', () => {
    it('should warn and return early when no snapshot is available', async () => {
      await service.restoreFromSnapshot();

      expect(dbMock.db.delete).not.toHaveBeenCalled();
      expect(dbMock.db.insert).not.toHaveBeenCalled();
    });

    it('should restore all data from snapshot successfully', async () => {
      dbMock.setQueryResult([
        { id: 1, name: 'Category 1' },
        { id: 2, name: 'Category 2' },
      ]);

      await service.createSnapshot();

      vi.clearAllMocks();
      dbMock.setDeleteResult(2).setInsertResult([{ id: 1 }]);

      await service.restoreFromSnapshot();

      expect(dbMock.db.delete).toHaveBeenCalled();
    });

    it('should skip insert for tables with no data', async () => {
      dbMock.setQueryResult([]);

      await service.createSnapshot();

      vi.clearAllMocks();
      dbMock.setDeleteResult(0);

      await service.restoreFromSnapshot();

      expect(dbMock.db.delete).toHaveBeenCalled();
      expect(dbMock.db.insert).not.toHaveBeenCalled();
    });

    it('should handle errors during restoration', async () => {
      dbMock.setQueryResult([{ id: 1 }]);

      await service.createSnapshot();

      vi.clearAllMocks();

      dbMock.db.delete.mockImplementation(() => {
        throw new Error('Restore failed');
      });

      await expect(service.restoreFromSnapshot()).rejects.toThrow('Restore failed');
    });
  });

  describe('manualRestore', () => {
    it('should restore demo data when demo mode is enabled', async () => {
      const configMock = {
        get: vi.fn().mockReturnValue(true),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      dbMockForTest.setQueryResult([]);
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );

      await newService.createSnapshot();

      vi.clearAllMocks();
      dbMockForTest.setDeleteResult(0);

      const result = await newService.manualRestore();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Demo data restored successfully');
    });

    it('should fail when demo mode is disabled', async () => {
      const configMock = {
        get: vi.fn().mockReturnValue(false),
      };
      const newService = new DemoService(dbMock.build() as unknown as Database, configMock as any);

      const result = await newService.manualRestore();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Demo mode is not enabled');
    });

    it('should return error message when restoration fails', async () => {
      const configMock = {
        get: vi.fn().mockReturnValue(true),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      dbMockForTest.setQueryResult([{ id: 1 }]);
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );

      await newService.createSnapshot();

      vi.clearAllMocks();

      const errorMessage = 'Database connection lost';
      dbMockForTest.db.delete.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await newService.manualRestore();

      expect(result.success).toBe(false);
      expect(result.message).toBe(`Failed to restore demo data: ${errorMessage}`);
    });

    it('should handle non-Error exceptions', async () => {
      const configMock = {
        get: vi.fn().mockReturnValue(true),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      dbMockForTest.setQueryResult([{ id: 1 }]);
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );

      await newService.createSnapshot();

      vi.clearAllMocks();

      dbMockForTest.db.delete.mockImplementation(() => {
        throw new Error('String error');
      });

      const result = await newService.manualRestore();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to restore demo data: String error');
    });
  });

  describe('onModuleInit', () => {
    it('should create snapshot when demo mode is enabled in non-test environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const configMock = {
        get: vi.fn().mockReturnValue(true),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      dbMockForTest.setQueryResult([]);
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );

      const createSnapshotSpy = vi.spyOn(newService, 'createSnapshot');
      await newService.onModuleInit();

      expect(createSnapshotSpy).toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should skip snapshot in test environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const configMock = {
        get: vi.fn().mockReturnValue(true),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );

      const createSnapshotSpy = vi.spyOn(newService, 'createSnapshot');
      await newService.onModuleInit();

      expect(createSnapshotSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear interval when exists', () => {
      const configMock = {
        get: vi.fn().mockReturnValue(true),
      };
      const dbMockForTest = new DatabaseMockBuilder();
      const newService = new DemoService(
        dbMockForTest.build() as unknown as Database,
        configMock as any,
      );

      // Manually set an interval
      newService['restoreInterval'] = setInterval(() => {
        // no-op
      }, 1000);

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      newService.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(newService['restoreInterval']).toBeNull();
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
      dbMock.setQueryResult([
        { id: 1, title: 'Article 1' },
        { id: 2, title: 'Article 2' },
        { id: 3, title: 'Article 3' },
      ]);

      await service.createSnapshot();

      const result = service.getSnapshotInfo();

      expect(result.hasSnapshot).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
    });
  });
});
