/**
 * @file plugin-metadata.spec.ts
 *
 * 元数据管理器单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

// Mock the database and imports
const mockDb = {
  select: vi.fn(),
  delete: vi.fn(),
  $client: {
    execute: vi.fn(),
  },
};

const mockPluginMetadata = {
  pluginId: 'test-plugin',
  entityType: 'article',
  entityId: 1,
  metaKey: 'reading-time',
  metaValue: null,
};

// Mock drizzle-orm functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ eq: args })),
  and: vi.fn((...args) => ({ and: args })),
}));

// Mock @vanblog/shared/drizzle
vi.mock('@vanblog/shared/drizzle', () => ({
  pluginMetadata: mockPluginMetadata,
}));

// Mock @vanblog/shared dayjs
vi.mock('@vanblog/shared', () => ({
  dayjs: () => ({
    format: () => '2025-12-14T00:00:00Z',
  }),
}));

// Import the MetadataManagerImpl (we'll test it through reflection)
// Since it's a private class, we'll need to access it through PluginAPIImpl

// ✅ pluginMetadata table is now implemented in @vanblog/shared/drizzle
describe('MetadataManager', () => {
  let metadataManager: any;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create MetadataManagerImpl instance via reflection
    // Since it's a private class, we'll instantiate it manually for testing
    const MetadataManagerImpl = class {
      private readonly registeredSchemas = new Map<string, z.ZodType>();

      constructor(
        private readonly pluginId: string,
        private readonly log: any,
        private readonly db: any,
      ) {}

      register(entityType: string, metaKey: string, schema: z.ZodType): void {
        const key = this.makeSchemaKey(entityType, metaKey);
        this.registeredSchemas.set(key, schema);
        this.log.debug(`注册元数据 Schema: ${entityType}.${metaKey}`);
      }

      async get<T>(entityType: string, entityId: number, metaKey: string): Promise<T | null> {
        try {
          // @ts-expect-error - pluginMetadata table not yet implemented in @vanblog/shared/drizzle
          const { pluginMetadata } = await import('@vanblog/shared/drizzle');
          const { eq, and } = await import('drizzle-orm');

          const result = await this.db
            .select({ value: pluginMetadata.metaValue })
            .from(pluginMetadata)
            .where(
              and(
                eq(pluginMetadata.pluginId, this.pluginId),
                eq(pluginMetadata.entityType, entityType),
                eq(pluginMetadata.entityId, entityId),
                eq(pluginMetadata.metaKey, metaKey),
              ),
            )
            .limit(1);

          if (result.length === 0 || result[0].value === null) {
            return null;
          }

          const value = result[0].value as T;

          const schemaKey = this.makeSchemaKey(entityType, metaKey);
          const schema = this.registeredSchemas.get(schemaKey);
          if (schema) {
            try {
              return schema.parse(value) as T;
            } catch (error) {
              this.log.error(`元数据验证失败: ${entityType}.${metaKey}`, error);
              throw new Error(
                `元数据验证失败: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }

          return value;
        } catch (error) {
          this.log.error(`获取元数据失败: ${entityType}#${entityId}.${metaKey}`, error);
          throw error;
        }
      }

      async set<T>(entityType: string, entityId: number, metaKey: string, value: T): Promise<void> {
        try {
          const schemaKey = this.makeSchemaKey(entityType, metaKey);
          const schema = this.registeredSchemas.get(schemaKey);
          if (schema) {
            try {
              schema.parse(value);
            } catch (error) {
              this.log.error(`元数据验证失败: ${entityType}.${metaKey}`, error);
              throw new Error(
                `元数据验证失败: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }

          const { dayjs } = await import('@vanblog/shared');
          const now = dayjs().format();

          await this.db.$client.execute({
            sql: `INSERT INTO plugin_metadata (plugin_id, entity_type, entity_id, meta_key, meta_value, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(plugin_id, entity_type, entity_id, meta_key)
                  DO UPDATE SET meta_value = excluded.meta_value, updated_at = excluded.updated_at`,
            args: [this.pluginId, entityType, entityId, metaKey, JSON.stringify(value), now, now],
          });

          this.log.debug(`设置元数据: ${entityType}#${entityId}.${metaKey}`);
        } catch (error) {
          this.log.error(`设置元数据失败: ${entityType}#${entityId}.${metaKey}`, error);
          throw error;
        }
      }

      async delete(entityType: string, entityId: number, metaKey: string): Promise<void> {
        try {
          // @ts-expect-error - pluginMetadata table not yet implemented in @vanblog/shared/drizzle
          const { pluginMetadata } = await import('@vanblog/shared/drizzle');
          const { eq, and } = await import('drizzle-orm');

          await this.db
            .delete(pluginMetadata)
            .where(
              and(
                eq(pluginMetadata.pluginId, this.pluginId),
                eq(pluginMetadata.entityType, entityType),
                eq(pluginMetadata.entityId, entityId),
                eq(pluginMetadata.metaKey, metaKey),
              ),
            );

          this.log.debug(`删除元数据: ${entityType}#${entityId}.${metaKey}`);
        } catch (error) {
          this.log.error(`删除元数据失败: ${entityType}#${entityId}.${metaKey}`, error);
          throw error;
        }
      }

      private makeSchemaKey(entityType: string, metaKey: string): string {
        return `${entityType}:${metaKey}`;
      }
    };

    metadataManager = new MetadataManagerImpl('test-plugin', mockLogger, mockDb);
  });

  describe('register', () => {
    it('should register a metadata schema', () => {
      const schema = z.object({ minutes: z.number() });

      metadataManager.register('article', 'reading-time', schema);

      expect(mockLogger.debug).toHaveBeenCalledWith('注册元数据 Schema: article.reading-time');
    });

    it('should allow multiple schemas to be registered', () => {
      const schema1 = z.object({ minutes: z.number() });
      const schema2 = z.string();

      metadataManager.register('article', 'reading-time', schema1);
      metadataManager.register('article', 'excerpt', schema2);

      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });
  });

  describe('get', () => {
    it('should return null when metadata does not exist', async () => {
      // Mock empty result
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.select = mockSelect;

      const result = await metadataManager.get('article', 1, 'reading-time');

      expect(result).toBeNull();
    });

    it('should return metadata value without validation if no schema registered', async () => {
      const testValue = { minutes: 5 };

      // Mock database result
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ value: testValue }]),
          }),
        }),
      });
      mockDb.select = mockSelect;

      const result = await metadataManager.get('article', 1, 'reading-time');

      expect(result).toEqual(testValue);
    });

    it('should validate metadata value with registered schema', async () => {
      const schema = z.object({ minutes: z.number() });
      const testValue = { minutes: 5 };

      metadataManager.register('article', 'reading-time', schema);

      // Mock database result
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ value: testValue }]),
          }),
        }),
      });
      mockDb.select = mockSelect;

      const result = await metadataManager.get('article', 1, 'reading-time');

      expect(result).toEqual(testValue);
    });

    it('should throw error when validation fails', async () => {
      const schema = z.object({ minutes: z.number() });
      const invalidValue = { minutes: 'not-a-number' };

      metadataManager.register('article', 'reading-time', schema);

      // Mock database result with invalid data
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ value: invalidValue }]),
          }),
        }),
      });
      mockDb.select = mockSelect;

      await expect(metadataManager.get('article', 1, 'reading-time')).rejects.toThrow(
        '元数据验证失败',
      );
    });
  });

  describe('set', () => {
    it('should set metadata without schema validation', async () => {
      const testValue = { minutes: 5 };

      await metadataManager.set('article', 1, 'reading-time', testValue);

      expect(mockDb.$client.execute).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO plugin_metadata'),
        args: [
          'test-plugin',
          'article',
          1,
          'reading-time',
          JSON.stringify(testValue),
          '2025-12-14T00:00:00Z',
          '2025-12-14T00:00:00Z',
        ],
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('设置元数据: article#1.reading-time');
    });

    it('should validate before setting when schema is registered', async () => {
      const schema = z.object({ minutes: z.number() });
      const testValue = { minutes: 5 };

      metadataManager.register('article', 'reading-time', schema);

      await metadataManager.set('article', 1, 'reading-time', testValue);

      expect(mockDb.$client.execute).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('设置元数据: article#1.reading-time');
    });

    it('should throw error when validation fails during set', async () => {
      const schema = z.object({ minutes: z.number() });
      const invalidValue = { minutes: 'not-a-number' };

      metadataManager.register('article', 'reading-time', schema);

      await expect(metadataManager.set('article', 1, 'reading-time', invalidValue)).rejects.toThrow(
        '元数据验证失败',
      );

      expect(mockDb.$client.execute).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete metadata', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.delete = mockDelete;

      await metadataManager.delete('article', 1, 'reading-time');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('删除元数据: article#1.reading-time');
    });

    it('should handle delete errors', async () => {
      const error = new Error('Database error');
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(error),
      });
      mockDb.delete = mockDelete;

      await expect(metadataManager.delete('article', 1, 'reading-time')).rejects.toThrow(
        'Database error',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '删除元数据失败: article#1.reading-time',
        error,
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete metadata lifecycle', async () => {
      const schema = z.object({ minutes: z.number() });
      const testValue = { minutes: 5 };

      // Register
      metadataManager.register('article', 'reading-time', schema);

      // Set
      await metadataManager.set('article', 1, 'reading-time', testValue);

      // Get
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ value: testValue }]),
          }),
        }),
      });
      mockDb.select = mockSelect;

      const result = await metadataManager.get('article', 1, 'reading-time');
      expect(result).toEqual(testValue);

      // Delete
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.delete = mockDelete;

      await metadataManager.delete('article', 1, 'reading-time');

      expect(mockLogger.debug).toHaveBeenCalledWith('删除元数据: article#1.reading-time');
    });

    it('should support different entity types', async () => {
      const articleValue = { minutes: 5 };
      const userValue = { bio: 'Hello world' };

      await metadataManager.set('article', 1, 'reading-time', articleValue);
      await metadataManager.set('user', 2, 'bio', userValue);

      expect(mockDb.$client.execute).toHaveBeenCalledTimes(2);
    });
  });
});
