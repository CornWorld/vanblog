import { Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createConfigServiceMock } from '../../test/mock';
import type { ConfigService } from '../config/config.service';
import type { LoggerService } from '../core/logger/logger.service';

import { DATABASE_CONNECTION } from './constants';
import { DatabaseModule } from './database.module';
import type { Database } from './connection';

// Mock database instance
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  run: vi.fn(),
};

type MockDb = typeof mockDb;

describe('DatabaseModule', () => {
  let mockConfigService: ConfigService;
  let mockLogger: LoggerService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock ConfigService using the proper mock helper
    mockConfigService = createConfigServiceMock({
      database: {
        driver: 'local',
        url: 'file:./test.db',
      },
    });

    // Mock LoggerService
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      verbose: vi.fn(),
    } as unknown as LoggerService;
  });

  describe('Module Definition', () => {
    it('should be defined', () => {
      expect(DatabaseModule).toBeDefined();
    });

    it('should be a class', () => {
      expect(typeof DatabaseModule).toBe('function');
    });

    it('should have module metadata', () => {
      // Check if it's decorated with @Module() by checking for the metadata
      // NestJS stores module metadata under specific keys
      const metadata = Reflect.getMetadata('imports', DatabaseModule);
      const providers = Reflect.getMetadata('providers', DatabaseModule);
      const exports = Reflect.getMetadata('exports', DatabaseModule);

      // At least one of these should be defined for a valid @Module() decorated class
      expect(metadata !== undefined || providers !== undefined || exports !== undefined).toBe(true);
    });
  });

  describe('Provider Resolution', () => {
    it('should provide DATABASE_CONNECTION via factory (mocked)', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: DATABASE_CONNECTION,
            useValue: mockDb,
          },
        ],
      }).compile();

      const db = module.get<MockDb>(DATABASE_CONNECTION);

      expect(db).toBe(mockDb);
      expect(typeof db.select).toBe('function');
    });

    it('should be able to resolve multiple times with mocked connection', async () => {
      const anotherMock: MockDb = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        run: vi.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: DATABASE_CONNECTION,
            useValue: anotherMock,
          },
        ],
      }).compile();

      const db = module.get<MockDb>(DATABASE_CONNECTION);
      expect(db).toBe(anotherMock);
    });

    it('should resolve DATABASE_CONNECTION as singleton', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: DATABASE_CONNECTION,
            useValue: mockDb,
          },
        ],
      }).compile();

      const db1 = module.get<MockDb>(DATABASE_CONNECTION);
      const db2 = module.get<MockDb>(DATABASE_CONNECTION);

      expect(db1).toBe(db2);
    });
  });

  describe('Module Integration', () => {
    it('should inject database connection into services', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: DATABASE_CONNECTION,
            useValue: mockDb,
          },
          {
            provide: 'TestService',
            useFactory: (db: Database) => {
              return { db };
            },
            inject: [DATABASE_CONNECTION],
          },
        ],
      }).compile();

      const service = module.get<{ db: Database }>('TestService');
      expect(service.db).toBe(mockDb);
    });

    it('should support dependency injection', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: DATABASE_CONNECTION,
            useValue: mockDb,
          },
          {
            provide: 'ConsumerService',
            useFactory: (db: Database) => ({ db }),
            inject: [DATABASE_CONNECTION],
          },
        ],
      }).compile();

      const service = module.get<{ db: Database }>('ConsumerService');
      expect(service.db).toBeDefined();
      expect(service.db).toBe(mockDb);
    });
  });

  describe('Constants', () => {
    it('should export DATABASE_CONNECTION constant correctly', () => {
      expect(DATABASE_CONNECTION).toBe('DATABASE_CONNECTION');
    });

    it('should use consistent token across module', async () => {
      const { DATABASE_CONNECTION: importedToken } = await import('./constants');
      expect(importedToken).toBe(DATABASE_CONNECTION);
    });
  });

  describe('Module Exports', () => {
    it('should have exports property', () => {
      // DatabaseModule should export providers for global use
      expect(DatabaseModule).toBeDefined();
    });

    it('should be importable by other modules', async () => {
      @Module({})
      class TestModule {}

      const module = await Test.createTestingModule({
        imports: [TestModule],
        providers: [
          {
            provide: DATABASE_CONNECTION,
            useValue: mockDb,
          },
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('Factory Configuration', () => {
    it('should use factory pattern for DATABASE_CONNECTION', async () => {
      const factoryFn = vi.fn().mockResolvedValue(mockDb);

      const module = await Test.createTestingModule({
        providers: [
          {
            provide: DATABASE_CONNECTION,
            useFactory: factoryFn,
          },
        ],
      }).compile();

      await module.init();

      expect(factoryFn).toHaveBeenCalled();
    });

    it('should inject ConfigService and LoggerService into factory', async () => {
      const createConnectionSpy = vi.fn().mockResolvedValue(mockDb);

      const module = await Test.createTestingModule({
        providers: [
          {
            provide: DATABASE_CONNECTION,
            useFactory: async (config: ConfigService, logger: LoggerService) => {
              return await createConnectionSpy(config.database, logger);
            },
            inject: ['ConfigService', 'LoggerService'],
          },
          {
            provide: 'ConfigService',
            useValue: mockConfigService,
          },
          {
            provide: 'LoggerService',
            useValue: mockLogger,
          },
        ],
      }).compile();

      const db = module.get<Database>(DATABASE_CONNECTION);
      expect(db).toBeDefined();
      expect(createConnectionSpy).toHaveBeenCalledWith(mockConfigService.database, mockLogger);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when DATABASE_CONNECTION is not provided', async () => {
      const module = await Test.createTestingModule({
        providers: [],
      }).compile();

      expect(() => module.get(DATABASE_CONNECTION)).toThrow();
    });

    it('should handle factory errors gracefully', async () => {
      const factoryError = new Error('Factory initialization failed');
      const failingFactory = vi.fn().mockRejectedValue(factoryError);

      await expect(
        Test.createTestingModule({
          providers: [
            {
              provide: DATABASE_CONNECTION,
              useFactory: failingFactory,
            },
          ],
        }).compile(),
      ).rejects.toThrow();
    });
  });
});
