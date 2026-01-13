/**
 * @fileoverview PipelineService 测试
 *
 * 测试场景：
 * - 流水线 CRUD 操作（create, findAll, findOne, update, remove）
 * - 事件名查询（findByEventName）
 * - 流水线触发（triggerById, dispatchEvent）
 * - 配置获取（getConfig）
 * - 默认脚本设置
 * - 事件名验证
 * - 异常处理（NotFoundException, BadRequestException）
 * - 软删除逻辑
 *
 * 数据库策略：
 * - 使用真实数据库 + 事务回滚（withTestTransaction）
 * - 测试数据自动清理，无需手动维护
 * - 验证真实 SQL 查询和数据持久化
 *
 * Mock 保留：
 * - 文件系统操作（existsSync, mkdirSync, rmSync, writeFileSync）
 * - 子进程执行（child_process.fork）
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pipelines } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';
import { describe, beforeEach, it, expect, vi, afterEach } from 'vitest';

import { db } from '@test/setup.unit';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { Mock } from '@test/mock';
import { DATABASE_CONNECTION } from '../../database';
import { PipelineService } from './pipeline.service';

// Mock entire file system module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  fork: vi.fn(),
}));

// Mock ConfigService
const mockConfigService = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    if (key === 'pipeline.runnerPath') return '/tmp/test-pipelines';
    return defaultValue;
  }),
};

describe('PipelineService', () => {
  // Create pipelines table once before all tests (schema mismatch workaround)
  beforeAll(async () => {
    await db.run(`
      CREATE TABLE IF NOT EXISTS "pipelines" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "enabled" integer DEFAULT true NOT NULL,
        "event_name" text NOT NULL,
        "script" text NOT NULL,
        "deps" text DEFAULT '[]' NOT NULL,
        "status" text DEFAULT 'idle' NOT NULL,
        "last_run" text,
        "last_status" text,
        "last_error" text,
        "deleted" integer DEFAULT false NOT NULL,
        "created_at" text NOT NULL,
        "updated_at" text NOT NULL
      )
    `);
  });

  // Clean up pipelines table after all tests
  afterAll(async () => {
    await db.run(`DROP TABLE IF EXISTS "pipelines"`);
  });
  let service: PipelineService;

  beforeEach(async () => {
    // Import mocked modules
    const fs = await import('fs');
    // const _childProcess = await import('child_process');

    // Reset all mocks
    vi.clearAllMocks();

    // Mock file system - directory exists
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PipelineService>(PipelineService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all non-deleted pipelines', async () => {
      await withTestTransaction(db, async (tx) => {
        // 注入事务数据库
        (service as any)['db'] = tx as any;

        // 创建测试数据
        const [_pipeline1] = await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 1,
              name: 'Pipeline 1',
              eventName: 'article|afterCreate',
            }) as any,
          )
          .returning();

        await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 2,
              name: 'Pipeline 2',
              eventName: 'article|afterUpdate',
              enabled: false,
            }) as any,
          )
          .returning();

        // 创建一个已删除的流水线（不应被返回）
        await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 3,
              name: 'Deleted Pipeline',
              eventName: 'article|afterDelete',
              deleted: true,
            }) as any,
          )
          .returning();

        const result = await service.findAll();

        expect(result.items).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.items[0].name).toBe('Pipeline 1');
        expect(result.items[1].name).toBe('Pipeline 2');
      });
    });

    it('should return empty list when no pipelines exist', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const result = await service.findAll();

        expect(result.items).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    it('should order pipelines by createdAt desc', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 创建多个流水线
        await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 1,
              name: 'First Pipeline',
              createdAt: '2024-01-01T00:00:00.000Z',
            }) as any,
          )
          .returning();

        await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 2,
              name: 'Second Pipeline',
              createdAt: '2024-01-02T00:00:00.000Z',
            }) as any,
          )
          .returning();

        const result = await service.findAll();

        expect(result.items).toHaveLength(2);
        expect(result.items[0].name).toBe('Second Pipeline'); // 最新的在前
        expect(result.items[1].name).toBe('First Pipeline');
      });
    });
  });

  describe('findOne', () => {
    it('should return pipeline by id', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const [created] = await tx
          .insert(pipelines)
          .values(Mock.pipeline({ id: 1, name: 'Test Pipeline' }) as any)
          .returning();

        const result = await service.findOne(created.id);

        expect(result).toBeDefined();
        expect(result.id).toBe(created.id);
        expect(result.name).toBe('Test Pipeline');
      });
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
        await expect(service.findOne(999)).rejects.toThrow('Pipeline with ID 999 not found');
      });
    });

    it('should not return deleted pipelines', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const [deleted] = await tx
          .insert(pipelines)
          .values(Mock.pipeline({ id: 1, name: 'Deleted Pipeline', deleted: true }) as any)
          .returning();

        await expect(service.findOne(deleted.id)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('findByEventName', () => {
    it('should return enabled pipelines for event', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 1,
              name: 'Pipeline 1',
              eventName: 'article|afterCreate',
              enabled: true,
            }) as any,
          )
          .returning();

        await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 2,
              name: 'Pipeline 2',
              eventName: 'article|afterCreate',
              enabled: false, // 禁用的流水线不应被返回
            }) as any,
          )
          .returning();

        const result = await service.findByEventName('article|afterCreate');

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Pipeline 1');
        expect(result[0].enabled).toBe(true);
      });
    });

    it('should return empty array when no pipelines match event', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const result = await service.findByEventName('non-existent-event');

        expect(result).toHaveLength(0);
      });
    });

    it('should not return deleted pipelines', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 1,
              name: 'Deleted Pipeline',
              eventName: 'article|afterCreate',
              enabled: true,
              deleted: true, // 已删除
            }) as any,
          )
          .returning();

        const result = await service.findByEventName('article|afterCreate');

        expect(result).toHaveLength(0);
      });
    });
  });

  describe('create', () => {
    it('should create a new pipeline', async () => {
      const fs = await import('fs');

      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;
        vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

        const createDto = {
          name: 'New Pipeline',
          eventName: 'article|afterCreate',
          script: 'console.log("new")',
          enabled: true,
          deps: [],
        };

        const result = await service.create(createDto);

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.name).toBe('New Pipeline');
        expect(result.eventName).toBe('article|afterCreate');
        expect(result.script).toBe('console.log("new")');
        expect(result.enabled).toBe(true);

        // 验证数据库持久化
        const [saved] = await tx.select().from(pipelines).where(eq(pipelines.id, result.id));
        expect(saved).toBeDefined();
        expect(saved.name).toBe('New Pipeline');

        // 验证脚本文件已保存
        expect(fs.writeFileSync).toHaveBeenCalled();
      });
    });

    it('should set default script when script is empty', async () => {
      const fs = await import('fs');

      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;
        vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

        const createDto = {
          name: 'Empty Script Pipeline',
          eventName: 'article|afterCreate',
          script: '',
          enabled: true,
          deps: [],
        };

        const result = await service.create(createDto);

        expect(result.script).toContain('// Async task');
        expect(result.script).toContain('console.log');
        expect(result.script).toContain('Pipeline executed with input:');
      });
    });

    it('should throw error when event name is invalid', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const createDto = {
          name: 'Invalid Event',
          eventName: '',
          script: 'console.log("test")',
          enabled: true,
          deps: [],
        };

        await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
        await expect(service.create(createDto)).rejects.toThrow('Event name is required');
      });
    });

    it('should throw error when event name is whitespace only', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const createDto = {
          name: 'Whitespace Event',
          eventName: '   ',
          script: 'console.log("test")',
          enabled: true,
          deps: [],
        };

        await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('update', () => {
    it('should update an existing pipeline', async () => {
      const fs = await import('fs');

      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;
        vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

        // 创建现有流水线
        const [existing] = await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 1,
              name: 'Original Name',
              script: 'original script',
            }) as any,
          )
          .returning();

        const updateDto = {
          name: 'Updated Name',
          script: 'new script',
        };

        const result = await service.update(existing.id, updateDto);

        expect(result.name).toBe('Updated Name');
        expect(result.script).toBe('new script');

        // 验证数据库持久化
        const [saved] = await tx.select().from(pipelines).where(eq(pipelines.id, existing.id));
        expect(saved.name).toBe('Updated Name');
        expect(saved.script).toBe('new script');
      });
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
      });
    });

    it('should validate event name when provided in update', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const [existing] = await tx
          .insert(pipelines)
          .values(Mock.pipeline({ id: 1, eventName: 'article|afterCreate' }) as any)
          .returning();

        const updateDto = {
          eventName: '   ', // whitespace only
        };

        await expect(service.update(existing.id, updateDto)).rejects.toThrow(BadRequestException);
      });
    });

    it('should update updatedAt timestamp', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const [existing] = await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 1,
              updatedAt: '2024-01-01T00:00:00.000Z',
            }) as any,
          )
          .returning();

        // 等待至少 1ms 确保 updatedAt 变化
        await new Promise((resolve) => setTimeout(resolve, 10));

        await service.update(existing.id, { name: 'Updated' });

        const [saved] = await tx.select().from(pipelines).where(eq(pipelines.id, existing.id));
        expect(saved.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
      });
    });
  });

  describe('remove', () => {
    it('should soft delete a pipeline', async () => {
      const fs = await import('fs');

      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;
        vi.mocked(fs.rmSync).mockReturnValue(undefined);

        const [existing] = await tx
          .insert(pipelines)
          .values(Mock.pipeline({ id: 1, name: 'To Delete', deleted: false }) as any)
          .returning();

        await service.remove(existing.id);

        // 验证软删除标记
        const [saved] = await tx.select().from(pipelines).where(eq(pipelines.id, existing.id));
        expect(saved.deleted).toBe(true);

        // 验证 findOne 不再返回该流水线
        await expect(service.findOne(existing.id)).rejects.toThrow(NotFoundException);
      });
    });

    it('should throw NotFoundException when pipeline not found', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      });
    });

    it('should delete script file', async () => {
      const fs = await import('fs');

      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.rmSync).mockReturnValue(undefined);

        const [existing] = await tx
          .insert(pipelines)
          .values(Mock.pipeline({ id: 1 }) as any)
          .returning();

        await service.remove(existing.id);

        // 验证尝试删除脚本文件
        expect(fs.rmSync).toHaveBeenCalled();
      });
    });
  });

  describe('getConfig', () => {
    it('should return available event names', () => {
      const result = service.getConfig();

      expect(result.events).toBeDefined();
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events).toContain('article|beforeCreate');
      expect(result.events).toContain('article|afterCreate');
    });

    it('should include all expected event types', () => {
      const result = service.getConfig();

      expect(result.events).toContain('article|beforeCreate');
      expect(result.events).toContain('article|afterCreate');
      expect(result.events).toContain('article|beforeUpdate');
      expect(result.events).toContain('article|afterUpdate');
      expect(result.events).toContain('article|afterDelete');
      expect(result.events).toContain('draft|afterPublish');
      expect(result.events).toContain('user|afterCreate');
      expect(result.events).toContain('user|afterUpdate');
      expect(result.events).toContain('setting|afterUpdate');
    });
  });

  describe('triggerById', () => {
    it('should throw BadRequestException when pipeline is disabled', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const [disabled] = await tx
          .insert(pipelines)
          .values(Mock.pipeline({ id: 1, name: 'Disabled Pipeline', enabled: false }) as any)
          .returning();

        await expect(service.triggerById(disabled.id, {})).rejects.toThrow(BadRequestException);
        await expect(service.triggerById(disabled.id, {})).rejects.toThrow(
          `Pipeline ${String(disabled.id)} is disabled`,
        );
      });
    });

    it('should call runCodeByPipelineId for enabled pipeline', async () => {
      const childProcess = await import('child_process');

      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const [enabled] = await tx
          .insert(pipelines)
          .values(Mock.pipeline({ id: 1, name: 'Enabled Pipeline', enabled: true }) as any)
          .returning();

        // Mock fork to simulate successful child process execution
        const mockChildProcess = {
          send: vi.fn(),
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            // Simulate successful message from child process
            if (event === 'message') {
              setTimeout(() => {
                handler({
                  status: 'success',
                  output: { test: 'result' },
                  logs: ['test log'],
                });
              }, 10);
            }
          }),
          kill: vi.fn(),
        };
        vi.mocked(childProcess.fork).mockReturnValue(mockChildProcess as any);

        // Execute the trigger
        const result = await service.triggerById(enabled.id, { test: 'data' });

        // Verify it executed successfully
        expect(result).toBeDefined();
        expect(result.status).toBe('success');
      });
    });
  });

  describe('dispatchEvent', () => {
    it('should be defined as a method', () => {
      expect(service.dispatchEvent).toBeDefined();
      expect(typeof service.dispatchEvent).toBe('function');
    });

    it('should return empty array when no pipelines match event', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const results = await service.dispatchEvent('non-existent-event', { test: 'data' });

        expect(results).toEqual([]);
      });
    });

    it('should execute all enabled pipelines for event', async () => {
      const childProcess = await import('child_process');

      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 创建多个流水线
        await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 1,
              name: 'Pipeline 1',
              eventName: 'test|event',
              enabled: true,
            }) as any,
          )
          .returning();

        await tx
          .insert(pipelines)
          .values(
            Mock.pipeline({
              id: 2,
              name: 'Pipeline 2',
              eventName: 'test|event',
              enabled: true,
            }) as any,
          )
          .returning();

        // Mock child process
        const mockChildProcess = {
          send: vi.fn(),
          on: vi.fn((event, handler) => {
            if (event === 'message') {
              // Simulate successful execution
              setTimeout(() => {
                handler({
                  status: 'success',
                  output: { test: 'result' },
                  logs: ['test log'],
                } as any);
              }, 0);
            }
          }),
          kill: vi.fn(),
        };
        vi.mocked(childProcess.fork).mockReturnValue(mockChildProcess as any);

        const results = await service.dispatchEvent('test|event', { test: 'input' });

        expect(results).toHaveLength(2);
      });
    });
  });

  describe('data persistence verification', () => {
    it('should verify transaction rollback - no side effects between tests', async () => {
      // 这个测试验证事务回滚机制
      // 由于每个测试都在独立事务中执行，前面的测试不应影响这个测试

      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 验证数据库是空的（事务隔离）
        const pipelinesBefore = await tx.select().from(pipelines);
        expect(pipelinesBefore).toHaveLength(0);

        // 创建流水线
        await service.create({
          name: 'Isolation Test',
          eventName: 'test|event',
          script: 'test',
          enabled: true,
          deps: [],
        });

        // 验证数据存在（在事务内）
        const pipelinesAfter = await tx.select().from(pipelines);
        expect(pipelinesAfter).toHaveLength(1);
      });

      // 事务外应该没有数据（已回滚）
      const pipelinesOutside = await db.select().from(pipelines);
      expect(pipelinesOutside).toHaveLength(0);
    });
  });

  describe('constructor directory creation', () => {
    it('should ensure runner directory exists when directory does not exist', async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const module = await Test.createTestingModule({
        providers: [
          PipelineService,
          {
            provide: DATABASE_CONNECTION,
            useValue: db,
          },
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const localService = module.get<PipelineService>(PipelineService);

      // 验证服务可以被正确创建和获取
      expect(localService).toBeDefined();

      // 验证 mkdirSync 被调用
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });
});
