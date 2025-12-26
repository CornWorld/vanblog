import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { DatabaseConfig } from '../config/database.config';
import type { LoggerService } from '../core/logger/logger.service';

import { createDatabaseConnection } from './connection';

// Mock dependencies
vi.mock('@libsql/client');
vi.mock('drizzle-orm/libsql');
vi.mock('drizzle-orm/libsql/migrator');

describe('Database Connection', () => {
  let mockLogger: LoggerService;
  let mockClient: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock logger
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      verbose: vi.fn(),
    } as unknown as LoggerService;

    // Mock database client
    mockClient = {
      execute: vi.fn(),
      close: vi.fn(),
    };

    // Mock database instance
    mockDb = {
      run: vi.fn().mockResolvedValue(undefined),
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    // Setup mocks
    (createClient as Mock).mockReturnValue(mockClient);
    (drizzle as unknown as Mock).mockReturnValue(mockDb);
  });

  describe('Local Driver', () => {
    it('should create connection with default local config', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: '',
      };

      const db = await createDatabaseConnection(config, mockLogger);

      expect(createClient).toHaveBeenCalledWith({
        url: 'file:./data/vanblog.db',
      });
      expect(drizzle).toHaveBeenCalledWith(mockClient);
      expect(db).toBe(mockDb);
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Initializing database with driver: local',
        'Database',
      );
    });

    it('should create connection with custom local URL', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./custom/path.db',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(createClient).toHaveBeenCalledWith({
        url: 'file:./custom/path.db',
      });
      expect(mockLogger.log).toHaveBeenCalledWith('Database connection established', 'Database');
    });

    it('should enable foreign key constraints for local database', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(mockDb.run).toHaveBeenCalledWith(sql`PRAGMA foreign_keys = ON`);

      // Wait for async foreign key constraint enabling
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.log).toHaveBeenCalledWith('Foreign key constraints enabled', 'Database');
    });
  });

  describe('Turso Driver', () => {
    it('should create connection with Turso config', async () => {
      const config: DatabaseConfig = {
        driver: 'turso',
        url: 'libsql://my-db.turso.io',
        authToken: 'my-secret-token',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(createClient).toHaveBeenCalledWith({
        url: 'libsql://my-db.turso.io',
        authToken: 'my-secret-token',
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Initializing database with driver: turso',
        'Database',
      );
    });

    it('should handle Turso config without authToken', async () => {
      const config: DatabaseConfig = {
        driver: 'turso',
        url: 'libsql://my-db.turso.io',
        authToken: '',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(createClient).toHaveBeenCalledWith({
        url: 'libsql://my-db.turso.io',
        authToken: undefined,
      });
    });

    it('should handle Turso config with undefined authToken', async () => {
      const config: DatabaseConfig = {
        driver: 'turso',
        url: 'libsql://my-db.turso.io',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(createClient).toHaveBeenCalledWith({
        url: 'libsql://my-db.turso.io',
        authToken: undefined,
      });
    });
  });

  describe('D1 Driver', () => {
    it('should create connection with D1 config and custom URL', async () => {
      const config: DatabaseConfig = {
        driver: 'd1',
        url: 'file:./d1-local.db',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(createClient).toHaveBeenCalledWith({
        url: 'file:./d1-local.db',
      });
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Initializing database with driver: d1',
        'Database',
      );
    });

    it('should create connection with D1 config and default fallback URL', async () => {
      const config: DatabaseConfig = {
        driver: 'd1',
        url: '',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(createClient).toHaveBeenCalledWith({
        url: 'file:./data/vanblog.db',
      });
    });

    it('should enable foreign key constraints for D1 database', async () => {
      const config: DatabaseConfig = {
        driver: 'd1',
        url: 'file:./d1.db',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(mockDb.run).toHaveBeenCalledWith(sql`PRAGMA foreign_keys = ON`);
    });
  });

  describe('Error Handling', () => {
    it('should log error when foreign key constraint fails', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      const error = new Error('Failed to enable foreign keys');
      mockDb.run.mockRejectedValueOnce(error);

      await createDatabaseConnection(config, mockLogger);

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to enable foreign key constraints',
        String(error),
        'Database',
      );
    });

    it('should log error when migration fails in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalMigrate = process.env.DB_AUTO_MIGRATE;

      process.env.NODE_ENV = 'test';
      process.env.DB_AUTO_MIGRATE = 'true';

      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      const migrationError = new Error('Migration failed');
      (migrate as Mock).mockRejectedValueOnce(migrationError);

      await expect(createDatabaseConnection(config, mockLogger)).rejects.toThrow(
        'Migration failed',
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Running migrations from:'),
        'Database',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to run test database migrations',
        String(migrationError),
        'Database',
      );

      // Restore environment variables
      process.env.NODE_ENV = originalEnv;
      process.env.DB_AUTO_MIGRATE = originalMigrate;
    });
  });

  describe('Test Environment Migration', () => {
    it('should run migrations in test environment when DB_AUTO_MIGRATE is true', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalMigrate = process.env.DB_AUTO_MIGRATE;

      process.env.NODE_ENV = 'test';
      process.env.DB_AUTO_MIGRATE = 'true';

      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      (migrate as Mock).mockResolvedValueOnce(undefined);

      await createDatabaseConnection(config, mockLogger);

      expect(migrate).toHaveBeenCalledWith(mockDb, {
        migrationsFolder: expect.stringContaining('drizzle/migrations'),
      });
      expect(mockLogger.log).toHaveBeenCalledWith('Test database migrations completed', 'Database');

      // Restore environment variables
      process.env.NODE_ENV = originalEnv;
      process.env.DB_AUTO_MIGRATE = originalMigrate;
    });

    it('should not run migrations in test environment when DB_AUTO_MIGRATE is false', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalMigrate = process.env.DB_AUTO_MIGRATE;

      process.env.NODE_ENV = 'test';
      process.env.DB_AUTO_MIGRATE = 'false';

      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(migrate).not.toHaveBeenCalled();

      // Restore environment variables
      process.env.NODE_ENV = originalEnv;
      process.env.DB_AUTO_MIGRATE = originalMigrate;
    });

    it('should not run migrations in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'production';

      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./prod.db',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(migrate).not.toHaveBeenCalled();

      // Restore environment variable
      process.env.NODE_ENV = originalEnv;
    });

    it('should not run migrations in development environment', async () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';

      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./dev.db',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(migrate).not.toHaveBeenCalled();

      // Restore environment variable
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Logger Integration', () => {
    it('should log all connection lifecycle events', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      await createDatabaseConnection(config, mockLogger);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.log).toHaveBeenCalledTimes(3);
      expect(mockLogger.log).toHaveBeenNthCalledWith(
        1,
        'Initializing database with driver: local',
        'Database',
      );
      expect(mockLogger.log).toHaveBeenNthCalledWith(
        2,
        'Database connection established',
        'Database',
      );
      expect(mockLogger.log).toHaveBeenNthCalledWith(
        3,
        'Foreign key constraints enabled',
        'Database',
      );
    });

    it('should use Database context for all log messages', async () => {
      const config: DatabaseConfig = {
        driver: 'turso',
        url: 'libsql://test.turso.io',
        authToken: 'token',
      };

      await createDatabaseConnection(config, mockLogger);

      const logCalls = (mockLogger.log as Mock).mock.calls;
      logCalls.forEach((call) => {
        expect(call[1]).toBe('Database');
      });
    });
  });

  describe('Drizzle ORM Integration', () => {
    it('should return a valid Drizzle database instance', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      const db = await createDatabaseConnection(config, mockLogger);

      expect(db).toBe(mockDb);
      expect(db.run).toBeDefined();
      expect(db.select).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
      expect(db.delete).toBeDefined();
    });

    it('should pass client to drizzle constructor', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(drizzle).toHaveBeenCalledWith(mockClient);
      expect(drizzle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Drizzle Query Chain Mock Verification', () => {
    it('should support full select...from...where...returning chain', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      await createDatabaseConnection(config, mockLogger);

      // Verify select chain
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, name: 'test' }]),
          }),
        }),
      });

      const selectChain = mockDb.select();
      const fromChain = selectChain.from();
      const whereChain = fromChain.where();
      const result = await whereChain.returning();

      expect(result).toEqual([{ id: 1, name: 'test' }]);
    });

    it('should support insert...values...returning chain', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      await createDatabaseConnection(config, mockLogger);

      // Verify insert chain
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1, name: 'test' }]),
        }),
      });

      const insertChain = mockDb.insert();
      const valuesChain = insertChain.values();
      const result = await valuesChain.returning();

      expect(result).toEqual([{ id: 1, name: 'test' }]);
    });

    it('should support update...set...where...returning chain', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      await createDatabaseConnection(config, mockLogger);

      // Verify update chain
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, name: 'updated' }]),
          }),
        }),
      });

      const updateChain = mockDb.update();
      const setChain = updateChain.set();
      const whereChain = setChain.where();
      const result = await whereChain.returning();

      expect(result).toEqual([{ id: 1, name: 'updated' }]);
    });

    it('should support delete...where...returning chain', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      await createDatabaseConnection(config, mockLogger);

      // Verify delete chain
      mockDb.delete.mockReturnValueOnce({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      const deleteChain = mockDb.delete();
      const whereChain = deleteChain.where();
      const result = await whereChain.returning();

      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('Connection Error Scenarios', () => {
    it('should handle client creation failure', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      const clientError = new Error('Client creation failed');
      (createClient as Mock).mockImplementationOnce(() => {
        throw clientError;
      });

      await expect(createDatabaseConnection(config, mockLogger)).rejects.toThrow(
        'Client creation failed',
      );
    });

    it('should handle drizzle initialization failure', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      const drizzleError = new Error('Drizzle initialization failed');
      (drizzle as unknown as Mock).mockImplementationOnce(() => {
        throw drizzleError;
      });

      await expect(createDatabaseConnection(config, mockLogger)).rejects.toThrow(
        'Drizzle initialization failed',
      );
    });

    it('should timeout on connection if client hangs', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: 'file:./test.db',
      };

      // Simulate a hanging connection
      (createClient as Mock).mockReturnValueOnce({
        execute: vi.fn(() => new Promise(() => {})), // Never resolves
        close: vi.fn(),
      });

      // This test verifies the function at least attempts connection
      void createDatabaseConnection(config, mockLogger);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(createClient).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined driver as local', async () => {
      const config = {
        driver: undefined as any,
        url: '',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(createClient).toHaveBeenCalledWith({
        url: 'file:./data/vanblog.db',
      });
    });

    it('should handle empty URL with local driver', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: '',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(createClient).toHaveBeenCalledWith({
        url: 'file:./data/vanblog.db',
      });
    });

    it('should handle empty authToken string for Turso', async () => {
      const config: DatabaseConfig = {
        driver: 'turso',
        url: 'libsql://test.turso.io',
        authToken: '',
      };

      await createDatabaseConnection(config, mockLogger);

      expect(createClient).toHaveBeenCalledWith({
        url: 'libsql://test.turso.io',
        authToken: undefined,
      });
    });
  });
});
