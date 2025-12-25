import { describe, expect, it } from 'vitest';

import * as databaseExports from './index';
import { DATABASE_CONNECTION } from './constants';
import { createDatabaseConnection } from './connection';
import { DatabaseModule } from './database.module';

describe('Database Module Exports', () => {
  describe('Exported Members', () => {
    it('should export DatabaseModule', () => {
      expect(databaseExports.DatabaseModule).toBe(DatabaseModule);
      expect(databaseExports.DatabaseModule).toBeDefined();
    });

    it('should export DATABASE_CONNECTION constant', () => {
      expect(databaseExports.DATABASE_CONNECTION).toBe(DATABASE_CONNECTION);
      expect(databaseExports.DATABASE_CONNECTION).toBe('DATABASE_CONNECTION');
    });

    it('should export createDatabaseConnection function', () => {
      expect(databaseExports.createDatabaseConnection).toBe(createDatabaseConnection);
      expect(typeof databaseExports.createDatabaseConnection).toBe('function');
    });
  });

  describe('Export Types', () => {
    it('should export all required members', () => {
      const exportedKeys = Object.keys(databaseExports);

      expect(exportedKeys).toContain('DatabaseModule');
      expect(exportedKeys).toContain('DATABASE_CONNECTION');
      expect(exportedKeys).toContain('createDatabaseConnection');
    });

    it('should have exactly 3 exports', () => {
      const exportedKeys = Object.keys(databaseExports);
      expect(exportedKeys).toHaveLength(3);
    });

    it('should not export undefined members', () => {
      expect(databaseExports.DatabaseModule).not.toBeUndefined();
      expect(databaseExports.DATABASE_CONNECTION).not.toBeUndefined();
      expect(databaseExports.createDatabaseConnection).not.toBeUndefined();
    });
  });

  describe('Re-export Validation', () => {
    it('should re-export DatabaseModule from database.module', async () => {
      const { DatabaseModule: DirectImport } = await import('./database.module');
      expect(databaseExports.DatabaseModule).toBe(DirectImport);
    });

    it('should re-export DATABASE_CONNECTION from constants', async () => {
      const { DATABASE_CONNECTION: DirectImport } = await import('./constants');
      expect(databaseExports.DATABASE_CONNECTION).toBe(DirectImport);
    });

    it('should re-export createDatabaseConnection from connection', async () => {
      const { createDatabaseConnection: DirectImport } = await import('./connection');
      expect(databaseExports.createDatabaseConnection).toBe(DirectImport);
    });
  });

  describe('Module Interface', () => {
    it('should provide a clean public API', () => {
      const publicAPI = {
        DatabaseModule: databaseExports.DatabaseModule,
        DATABASE_CONNECTION: databaseExports.DATABASE_CONNECTION,
        createDatabaseConnection: databaseExports.createDatabaseConnection,
      };

      expect(publicAPI.DatabaseModule).toBeDefined();
      expect(publicAPI.DATABASE_CONNECTION).toBeDefined();
      expect(publicAPI.createDatabaseConnection).toBeDefined();
    });

    it('should allow destructured imports', () => {
      const { DatabaseModule, DATABASE_CONNECTION, createDatabaseConnection } = databaseExports;

      expect(DatabaseModule).toBeDefined();
      expect(DATABASE_CONNECTION).toBeDefined();
      expect(createDatabaseConnection).toBeDefined();
    });
  });
});
