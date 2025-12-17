/**
 * @file drizzle-to-sql.util.spec.ts
 *
 * 数据库自动迁移工具测试
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateCreateTableSQL,
  generateCreateIndexSQL,
  tableExists,
  executeCreateTable,
  autoMigrateTable,
} from './drizzle-to-sql.util';

// Mock logger
vi.mock('@nestjs/common', () => ({
  Logger: class {
    debug = vi.fn();
    log = vi.fn();
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
  },
}));

describe('Drizzle to SQL Utilities', () => {
  describe('generateCreateTableSQL', () => {
    it('should generate basic CREATE TABLE SQL', () => {
      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [
            {
              name: 'id',
              columnType: 'integer',
              primary: true,
              autoIncrement: true,
              notNull: true,
            },
            {
              name: 'name',
              columnType: 'text',
              notNull: true,
            },
            {
              name: 'email',
              columnType: 'text',
              unique: true,
            },
          ],
          indexes: [],
          primaryKeys: [],
        },
      };

      const sql = generateCreateTableSQL(mockTable as any, 'users');

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL');
      expect(sql).toContain('name TEXT NOT NULL');
      expect(sql).toContain('email TEXT UNIQUE');
    });

    it('should handle columns with default values', () => {
      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [
            {
              name: 'id',
              columnType: 'integer',
              primary: true,
              autoIncrement: true,
            },
            {
              name: 'status',
              columnType: 'text',
              default: 'active',
            },
            {
              name: 'count',
              columnType: 'integer',
              default: 0,
            },
          ],
          indexes: [],
          primaryKeys: [],
        },
      };

      const sql = generateCreateTableSQL(mockTable as any, 'items');

      expect(sql).toContain("status TEXT DEFAULT 'active'");
      expect(sql).toContain('count INTEGER DEFAULT 0');
    });

    it('should handle foreign key constraints', () => {
      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [
            {
              name: 'id',
              columnType: 'integer',
              primary: true,
            },
            {
              name: 'user_id',
              columnType: 'integer',
              references: {
                table: 'users',
                column: 'id',
                onUpdate: 'cascade',
                onDelete: 'set null',
              },
            },
          ],
          indexes: [],
          primaryKeys: [],
        },
      };

      const sql = generateCreateTableSQL(mockTable as any, 'posts');

      expect(sql).toContain('user_id INTEGER REFERENCES users(id)');
      expect(sql).toContain('ON UPDATE CASCADE');
      expect(sql).toContain('ON DELETE SET NULL');
    });

    it('should throw error when table config is missing', () => {
      const mockTable = {} as any;

      expect(() => generateCreateTableSQL(mockTable, 'invalid')).toThrow(
        '无法从 Drizzle 表中提取配置',
      );
    });
  });

  describe('generateCreateIndexSQL', () => {
    it('should generate CREATE INDEX SQL for regular indexes', () => {
      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [],
          indexes: [
            {
              name: 'idx_users_email',
              columns: [{ name: 'email' }],
              unique: false,
            },
            {
              name: 'idx_users_created_at',
              columns: [{ name: 'created_at' }],
              unique: false,
            },
          ],
          primaryKeys: [],
        },
      };

      const indexes = generateCreateIndexSQL(mockTable as any, 'users');

      expect(indexes).toHaveLength(2);
      expect(indexes[0]).toBe('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);');
      expect(indexes[1]).toBe(
        'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);',
      );
    });

    it('should generate UNIQUE INDEX SQL', () => {
      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [],
          indexes: [
            {
              name: 'unique_users_username',
              columns: [{ name: 'username' }],
              unique: true,
            },
          ],
          primaryKeys: [],
        },
      };

      const indexes = generateCreateIndexSQL(mockTable as any, 'users');

      expect(indexes).toHaveLength(1);
      expect(indexes[0]).toBe(
        'CREATE UNIQUE INDEX IF NOT EXISTS unique_users_username ON users (username);',
      );
    });

    it('should handle compound indexes', () => {
      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [],
          indexes: [
            {
              name: 'idx_users_name_email',
              columns: [{ name: 'name' }, { name: 'email' }],
              unique: false,
            },
          ],
          primaryKeys: [],
        },
      };

      const indexes = generateCreateIndexSQL(mockTable as any, 'users');

      expect(indexes).toHaveLength(1);
      expect(indexes[0]).toBe(
        'CREATE INDEX IF NOT EXISTS idx_users_name_email ON users (name, email);',
      );
    });

    it('should return empty array when no indexes defined', () => {
      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [],
          indexes: [],
          primaryKeys: [],
        },
      };

      const indexes = generateCreateIndexSQL(mockTable as any, 'users');

      expect(indexes).toEqual([]);
    });
  });

  describe('tableExists', () => {
    it('should return true when table exists', async () => {
      const mockDb = {
        $client: {
          execute: vi.fn().mockResolvedValue({
            rows: [{ name: 'users' }],
          }),
        },
      };

      const exists = await tableExists(mockDb, 'users');

      expect(exists).toBe(true);
      expect(mockDb.$client.execute).toHaveBeenCalledWith({
        sql: expect.stringContaining('SELECT name FROM sqlite_master'),
        args: ['users'],
      });
    });

    it('should return false when table does not exist', async () => {
      const mockDb = {
        $client: {
          execute: vi.fn().mockResolvedValue({
            rows: [],
          }),
        },
      };

      const exists = await tableExists(mockDb, 'nonexistent');

      expect(exists).toBe(false);
    });

    it('should return false on error', async () => {
      const mockDb = {
        $client: {
          execute: vi.fn().mockRejectedValue(new Error('Database error')),
        },
      };

      const exists = await tableExists(mockDb, 'users');

      expect(exists).toBe(false);
    });
  });

  describe('executeCreateTable', () => {
    it('should execute CREATE TABLE SQL successfully', async () => {
      const mockDb = {
        $client: {
          execute: vi.fn().mockResolvedValue({}),
        },
      };

      const sql = 'CREATE TABLE users (id INTEGER PRIMARY KEY);';
      const success = await executeCreateTable(mockDb, sql);

      expect(success).toBe(true);
      expect(mockDb.$client.execute).toHaveBeenCalledWith({
        sql,
        args: [],
      });
    });

    it('should handle "table already exists" error gracefully', async () => {
      const mockDb = {
        $client: {
          execute: vi.fn().mockRejectedValue(new Error('table already exists')),
        },
      };

      const sql = 'CREATE TABLE users (id INTEGER PRIMARY KEY);';
      const success = await executeCreateTable(mockDb, sql);

      expect(success).toBe(true);
    });

    it('should return false on other errors', async () => {
      const mockDb = {
        $client: {
          execute: vi.fn().mockRejectedValue(new Error('Syntax error')),
        },
      };

      const sql = 'INVALID SQL';
      const success = await executeCreateTable(mockDb, sql);

      expect(success).toBe(false);
    });
  });

  describe('autoMigrateTable', () => {
    it('should skip migration if table already exists', async () => {
      const mockDb = {
        $client: {
          execute: vi.fn().mockResolvedValue({
            rows: [{ name: 'users' }],
          }),
        },
      };

      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [
            {
              name: 'id',
              columnType: 'integer',
              primary: true,
            },
          ],
          indexes: [],
          primaryKeys: [],
        },
      };

      const success = await autoMigrateTable(mockDb, mockTable as any, 'users');

      expect(success).toBe(true);
      // Should only check existence, not create table
      expect(mockDb.$client.execute).toHaveBeenCalledTimes(1);
    });

    it('should create table and indexes if not exists', async () => {
      const mockDb = {
        $client: {
          execute: vi
            .fn()
            .mockResolvedValueOnce({ rows: [] }) // tableExists check
            .mockResolvedValueOnce({}) // CREATE TABLE
            .mockResolvedValueOnce({}), // CREATE INDEX
        },
      };

      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [
            {
              name: 'id',
              columnType: 'integer',
              primary: true,
            },
            {
              name: 'name',
              columnType: 'text',
            },
          ],
          indexes: [
            {
              name: 'idx_users_name',
              columns: [{ name: 'name' }],
              unique: false,
            },
          ],
          primaryKeys: [],
        },
      };

      const success = await autoMigrateTable(mockDb, mockTable as any, 'users');

      expect(success).toBe(true);
      // 1 check + 1 create table + 1 create index = 3 calls
      expect(mockDb.$client.execute).toHaveBeenCalledTimes(3);
    });

    it('should return false if table creation fails', async () => {
      const mockDb = {
        $client: {
          execute: vi
            .fn()
            .mockResolvedValueOnce({ rows: [] }) // tableExists check
            .mockRejectedValueOnce(new Error('Permission denied')), // CREATE TABLE fails
        },
      };

      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [
            {
              name: 'id',
              columnType: 'integer',
              primary: true,
            },
          ],
          indexes: [],
          primaryKeys: [],
        },
      };

      const success = await autoMigrateTable(mockDb, mockTable as any, 'users');

      expect(success).toBe(false);
    });

    it('should continue even if index creation fails', async () => {
      const mockDb = {
        $client: {
          execute: vi
            .fn()
            .mockResolvedValueOnce({ rows: [] }) // tableExists check
            .mockResolvedValueOnce({}) // CREATE TABLE
            .mockRejectedValueOnce(new Error('Index already exists')), // CREATE INDEX fails
        },
      };

      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [
            {
              name: 'id',
              columnType: 'integer',
              primary: true,
            },
          ],
          indexes: [
            {
              name: 'idx_users_id',
              columns: [{ name: 'id' }],
              unique: false,
            },
          ],
          primaryKeys: [],
        },
      };

      const success = await autoMigrateTable(mockDb, mockTable as any, 'users');

      // Should still return true even if index creation failed
      expect(success).toBe(true);
    });
  });

  describe('Integration tests', () => {
    it('should generate and execute complete table migration', async () => {
      const executeCalls: any[] = [];
      const mockDb = {
        $client: {
          execute: vi.fn().mockImplementation((params) => {
            executeCalls.push(params);
            if (params.sql.includes('SELECT name FROM sqlite_master')) {
              return Promise.resolve({ rows: [] });
            }
            return Promise.resolve({});
          }),
        },
      };

      const mockTable = {
        [Symbol.for('drizzle:Table')]: {
          columns: [
            {
              name: 'id',
              columnType: 'integer',
              primary: true,
              autoIncrement: true,
              notNull: true,
            },
            {
              name: 'plugin_id',
              columnType: 'text',
              notNull: true,
            },
            {
              name: 'data',
              columnType: 'text',
            },
            {
              name: 'created_at',
              columnType: 'text',
              notNull: true,
            },
          ],
          indexes: [
            {
              name: 'idx_plugin_data_plugin_id',
              columns: [{ name: 'plugin_id' }],
              unique: false,
            },
            {
              name: 'unique_plugin_data_id',
              columns: [{ name: 'id' }],
              unique: true,
            },
          ],
          primaryKeys: [],
        },
      };

      const success = await autoMigrateTable(mockDb, mockTable as any, 'plugin_test_table');

      expect(success).toBe(true);

      // Should have:
      // 1. tableExists check
      // 2. CREATE TABLE
      // 3. CREATE INDEX (first index)
      // 4. CREATE INDEX (second index)
      expect(executeCalls).toHaveLength(4);

      // Verify CREATE TABLE SQL
      const createTableCall = executeCalls[1];
      expect(createTableCall.sql).toContain('CREATE TABLE IF NOT EXISTS plugin_test_table');
      expect(createTableCall.sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL');
      expect(createTableCall.sql).toContain('plugin_id TEXT NOT NULL');

      // Verify CREATE INDEX SQLs
      const createIndex1 = executeCalls[2];
      expect(createIndex1.sql).toContain('CREATE INDEX IF NOT EXISTS idx_plugin_data_plugin_id');

      const createIndex2 = executeCalls[3];
      expect(createIndex2.sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS unique_plugin_data_id');
    });
  });
});
