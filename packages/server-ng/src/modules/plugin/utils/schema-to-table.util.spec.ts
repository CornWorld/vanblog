/**
 * @file schema-to-table.util.spec.ts
 *
 * 测试 Zod Schema → Drizzle Table 转换工具
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createTableFromSchema, tableExists, zodSchemaToTypeScript } from './schema-to-table.util';

// Mock the Logger
vi.mock('@nestjs/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Logger: class {
      warn = vi.fn();
      error = vi.fn();
      log = vi.fn();
      debug = vi.fn();
    },
  };
});

describe('Schema to Table Util', () => {
  describe('createTableFromSchema', () => {
    it('should create table from simple schema', () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const table = createTableFromSchema('users', schema);

      // Just verify table is created
      expect(table).toBeDefined();
      expect(typeof table).toBe('object');
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        id: z.number(),
        description: z.string().optional(),
      });

      const table = createTableFromSchema('items', schema);
      expect(table).toBeDefined();
    });

    it('should handle nullable fields', () => {
      const schema = z.object({
        id: z.number(),
        deletedAt: z.string().nullable(),
      });

      const table = createTableFromSchema('records', schema);
      expect(table).toBeDefined();
    });

    it('should handle default values', () => {
      const schema = z.object({
        id: z.number(),
        status: z.string().default('active'),
        count: z.number().default(0),
      });

      const table = createTableFromSchema('tasks', schema);
      expect(table).toBeDefined();
    });

    it('should handle boolean fields', () => {
      const schema = z.object({
        id: z.number(),
        isActive: z.boolean(),
        isDeleted: z.boolean().optional(),
      });

      const table = createTableFromSchema('flags', schema);
      expect(table).toBeDefined();
    });

    it('should handle date fields', () => {
      const schema = z.object({
        id: z.number(),
        createdAt: z.date(),
        updatedAt: z.date().optional(),
      });

      const table = createTableFromSchema('timestamps', schema);
      expect(table).toBeDefined();
    });

    it('should handle array fields', () => {
      const schema = z.object({
        id: z.number(),
        tags: z.array(z.string()),
      });

      const table = createTableFromSchema('tagged_items', schema);
      expect(table).toBeDefined();
    });

    it('should handle object fields', () => {
      const schema = z.object({
        id: z.number(),
        metadata: z.object({
          author: z.string(),
          version: z.number(),
        }),
      });

      const table = createTableFromSchema('documents', schema);
      expect(table).toBeDefined();
    });

    it('should handle enum fields', () => {
      const schema = z.object({
        id: z.number(),
        role: z.enum(['admin', 'user', 'guest']),
      });

      const table = createTableFromSchema('users', schema);
      expect(table).toBeDefined();
    });

    it('should handle literal fields', () => {
      const schema = z.object({
        id: z.number(),
        type: z.literal('article'),
      });

      const table = createTableFromSchema('content', schema);
      expect(table).toBeDefined();
    });

    it('should handle union fields', () => {
      const schema = z.object({
        id: z.number(),
        value: z.union([z.string(), z.number()]),
      });

      const table = createTableFromSchema('mixed_values', schema);
      expect(table).toBeDefined();
    });

    it('should handle integer numbers', () => {
      const schema = z.object({
        id: z.number().int(),
        count: z.number().int().optional(),
      });

      const table = createTableFromSchema('counters', schema);
      expect(table).toBeDefined();
    });

    it('should handle float numbers', () => {
      const schema = z.object({
        id: z.number(),
        price: z.number(), // No .int(), so it's a float
      });

      const table = createTableFromSchema('products', schema);
      expect(table).toBeDefined();
    });

    it('should handle complex nested schema', () => {
      const schema = z.object({
        id: z.number().int(),
        title: z.string(),
        author: z.object({
          name: z.string(),
          email: z.string().optional(),
        }),
        tags: z.array(z.string()),
        published: z.boolean().default(false),
        publishedAt: z.date().nullable(),
      });

      const table = createTableFromSchema('articles', schema);
      expect(table).toBeDefined();
    });
  });

  describe('tableExists', () => {
    it('should return true if table exists', async () => {
      const mockDb = {
        run: vi.fn().mockResolvedValue({
          rows: [{ name: 'users' }],
        }),
      };

      const exists = await tableExists(mockDb, 'users');

      expect(exists).toBe(true);
      expect(mockDb.run).toHaveBeenCalledWith({
        sql: expect.stringContaining('SELECT name FROM sqlite_master'),
        args: ['users'],
      });
    });

    it('should return false if table does not exist', async () => {
      const mockDb = {
        run: vi.fn().mockResolvedValue({
          rows: [],
        }),
      };

      const exists = await tableExists(mockDb, 'nonexistent');

      expect(exists).toBe(false);
    });

    it('should return false on error', async () => {
      const mockDb = {
        run: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      const exists = await tableExists(mockDb, 'users');

      expect(exists).toBe(false);
    });
  });

  describe('zodSchemaToTypeScript', () => {
    it('should generate TypeScript type string', () => {
      const schema = z.object({
        name: z.string(),
      });

      const ts = zodSchemaToTypeScript(schema);

      // Just verify it generates valid TypeScript-like output
      expect(ts).toContain('name:');
      expect(ts).toContain('{');
      expect(ts).toContain('}');
    });

    it('should handle multiple fields', () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
        isActive: z.boolean(),
      });

      const ts = zodSchemaToTypeScript(schema);

      expect(ts).toContain('id:');
      expect(ts).toContain('name:');
      expect(ts).toContain('isActive:');
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        description: z.string().optional(),
      });

      const ts = zodSchemaToTypeScript(schema);

      expect(ts).toContain('description:');
    });

    it('should handle nullable fields', () => {
      const schema = z.object({
        deletedAt: z.string().nullable(),
      });

      const ts = zodSchemaToTypeScript(schema);

      expect(ts).toContain('deletedAt:');
    });
  });
});
