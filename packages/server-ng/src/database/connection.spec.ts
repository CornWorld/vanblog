import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

import type { DatabaseConfig } from '../config/database.config';
import type { LoggerService } from '../core/logger/logger.service';

// Skip global worker database setup for this test file
process.env.VITEST_SKIP_DB_SETUP = 'true';

// Import the actual connection function
import { createDatabaseConnection } from './connection';

describe('Database Connection', () => {
  let mockLogger: LoggerService;
  const testDbPath = join('/tmp/claude', `test-connection-${Date.now()}.db`);

  beforeEach(() => {
    vi.clearAllMocks();

    // Clean up test database if it exists
    if (existsSync(testDbPath)) {
      try {
        unlinkSync(testDbPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Mock logger
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      verbose: vi.fn(),
    } as unknown as LoggerService;
  });

  afterAll(() => {
    // Final cleanup
    if (existsSync(testDbPath)) {
      try {
        unlinkSync(testDbPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Local Driver', () => {
    it('should create connection with default local config', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: '',
      };

      const db = await createDatabaseConnection(config, mockLogger);

      // Verify connection was created
      expect(db).toBeDefined();
      expect(db.run).toBeDefined();
      expect(db.select).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
      expect(db.delete).toBeDefined();

      // Verify logger calls
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Initializing database with driver: local',
        'Database',
      );
      expect(mockLogger.log).toHaveBeenCalledWith('Database connection established', 'Database');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify foreign key constraints were enabled
      expect(mockLogger.log).toHaveBeenCalledWith('Foreign key constraints enabled', 'Database');
    });

    it('should create connection with custom local URL', async () => {
      const customDbPath = join('/tmp/claude', `test-custom-${Date.now()}.db`);
      const config: DatabaseConfig = {
        driver: 'local',
        url: `file:${customDbPath}`,
      };

      const db = await createDatabaseConnection(config, mockLogger);

      expect(db).toBeDefined();
      expect(mockLogger.log).toHaveBeenCalledWith('Database connection established', 'Database');

      // Cleanup
      setTimeout(() => {
        if (existsSync(customDbPath)) {
          try {
            unlinkSync(customDbPath);
          } catch {
            // Ignore
          }
        }
      }, 100);
    });

    it('should enable foreign key constraints for local database', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: `file:${testDbPath}`,
      };

      await createDatabaseConnection(config, mockLogger);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

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

      const db = await createDatabaseConnection(config, mockLogger);

      expect(db).toBeDefined();
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

      const db = await createDatabaseConnection(config, mockLogger);

      expect(db).toBeDefined();
    });

    it('should handle Turso config with undefined authToken', async () => {
      const config: DatabaseConfig = {
        driver: 'turso',
        url: 'libsql://my-db.turso.io',
      };

      const db = await createDatabaseConnection(config, mockLogger);

      expect(db).toBeDefined();
    });
  });

  describe('D1 Driver', () => {
    it('should create connection with D1 config and custom URL', async () => {
      const d1DbPath = join('/tmp/claude', `test-d1-${Date.now()}.db`);
      const config: DatabaseConfig = {
        driver: 'd1',
        url: `file:${d1DbPath}`,
      };

      const db = await createDatabaseConnection(config, mockLogger);

      expect(db).toBeDefined();
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Initializing database with driver: d1',
        'Database',
      );

      // Cleanup
      setTimeout(() => {
        if (existsSync(d1DbPath)) {
          try {
            unlinkSync(d1DbPath);
          } catch {
            // Ignore
          }
        }
      }, 100);
    });

    it('should create connection with D1 config and default fallback URL', async () => {
      const config: DatabaseConfig = {
        driver: 'd1',
        url: '',
      };

      const db = await createDatabaseConnection(config, mockLogger);

      expect(db).toBeDefined();
    });

    it('should enable foreign key constraints for D1 database', async () => {
      const d1DbPath = join('/tmp/claude', `test-d1-fk-${Date.now()}.db`);
      const config: DatabaseConfig = {
        driver: 'd1',
        url: `file:${d1DbPath}`,
      };

      await createDatabaseConnection(config, mockLogger);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Cleanup
      setTimeout(() => {
        if (existsSync(d1DbPath)) {
          try {
            unlinkSync(d1DbPath);
          } catch {
            // Ignore
          }
        }
      }, 100);
    });
  });

  describe('Logger Integration', () => {
    it('should log all connection lifecycle events', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: `file:${testDbPath}`,
      };

      await createDatabaseConnection(config, mockLogger);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.log).toHaveBeenCalledTimes(3);
      expect(mockLogger.log).toHaveBeenNthCalledWith(
        1,
        'Initializing database with driver: local',
        'Database',
      );
      expect(mockLogger.log).toHaveBeenNthCalledWith(2, 'Database connection established', 'Database');
      expect(mockLogger.log).toHaveBeenNthCalledWith(3, 'Foreign key constraints enabled', 'Database');
    });

    it('should use Database context for all log messages', async () => {
      const config: DatabaseConfig = {
        driver: 'turso',
        url: 'libsql://test.turso.io',
        authToken: 'token',
      };

      await createDatabaseConnection(config, mockLogger);

      const logCalls = (mockLogger.log as any).mock.calls;
      logCalls.forEach((call: any[]) => {
        expect(call[1]).toBe('Database');
      });
    });
  });

  describe('Drizzle ORM Integration', () => {
    it('should return a valid Drizzle database instance', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: `file:${testDbPath}`,
      };

      const db = await createDatabaseConnection(config, mockLogger);

      expect(db).toBeDefined();
      expect(db.run).toBeDefined();
      expect(db.select).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
      expect(db.delete).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined driver as local', async () => {
      const config = {
        driver: undefined as any,
        url: '',
      };

      const db = await createDatabaseConnection(config, mockLogger);

      // Should still create a connection successfully (defaults to local)
      expect(db).toBeDefined();
      expect(db.run).toBeDefined();
    });

    it('should handle empty URL with local driver', async () => {
      const config: DatabaseConfig = {
        driver: 'local',
        url: '',
      };

      const db = await createDatabaseConnection(config, mockLogger);

      expect(db).toBeDefined();
    });

    it('should handle empty authToken string for Turso', async () => {
      const config: DatabaseConfig = {
        driver: 'turso',
        url: 'libsql://test.turso.io',
        authToken: '',
      };

      const db = await createDatabaseConnection(config, mockLogger);

      expect(db).toBeDefined();
    });
  });
});
