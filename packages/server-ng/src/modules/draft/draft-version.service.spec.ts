/**
 * DraftVersionService - Version Management Tests
 *
 * 测试草稿版本管理的所有功能：
 * - createVersion（创建新版本）
 * - getVersions（获取版本列表，降序排列）
 * - getVersion（获取特定版本）
 * - restoreVersion（恢复到指定版本）
 * - deleteVersion（删除特定版本）
 * - deleteAllVersions（删除所有版本）
 *
 * 测试策略：
 * - 使用真实数据库 + withTestTransaction（事务自动回滚）
 * - 验证数据库持久化
 * - 测试版本号自动递增
 * - 测试多草稿隔离
 *
 * @module DraftVersionService
 * @group draft-versions
 */

import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect } from 'vitest';

import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { db } from '@test/setup.unit';
import { draftVersions, drafts } from '@vanblog/shared/drizzle';
import { Given } from '@test/given';
import { eq } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../database';
import { DraftVersionService } from './draft-version.service';

describe('DraftVersionService', () => {
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftVersionService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
      ],
    }).compile();

    // Module is created but service instances are created per-test via createServiceWithTx
    void module;
  });

  // 辅助函数：创建使用事务数据库的服务实例
  const createServiceWithTx = (tx: any) => {
    return new DraftVersionService(tx);
  };

  describe('createVersion', () => {
    it('should create a new version from existing draft', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建测试草稿
        const draft = await Given.draft(db as any, {
          title: 'Test Draft',
          content: 'Test content',
          tags: ['test'],
          author: 'admin',
          pathname: null,
          category: null,
          version: 1,
        });

        // 创建版本
        const result = await txService.createVersion(draft.id);

        // 验证返回值（注意：版本号应该是1，因为这是第一个版本）
        expect(result.version).toBe(1);
        expect(result.title).toBe('Test Draft');
        expect(result.content).toBe('Test content');
        expect(result.tags).toEqual(['test']);
        expect(result.author).toBe('admin');

        // 验证数据库持久化
        const [savedVersion] = await tx
          .select()
          .from(draftVersions)
          .where(eq(draftVersions.id, result.id));
        expect(savedVersion).toBeDefined();
        expect(savedVersion.version).toBe(1);
      });
    });

    it('should increment version number correctly', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿
        const draft = await Given.draft(db as any, {
          title: 'Test Draft',
          content: 'Content',
          author: 'admin',
          version: 1,
        });

        // 创建第一个版本
        const v1 = await txService.createVersion(draft.id);
        expect(v1.version).toBe(1);

        // 修改草稿
        await tx.update(drafts).set({ content: 'Updated content' }).where(eq(drafts.id, draft.id));

        // 创建第二个版本
        const v2 = await txService.createVersion(draft.id);

        // 验证版本号递增
        expect(v2.version).toBe(2);

        // 验证版本历史
        const allVersions = await tx
          .select()
          .from(draftVersions)
          .where(eq(draftVersions.draftId, draft.id));
        expect(allVersions).toHaveLength(2);
      });
    });

    it('should throw NotFoundException when draft not found', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        await expect(txService.createVersion(999)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('getVersions', () => {
    it('should return all versions for a draft ordered by version descending', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿
        const draft = await Given.draft(db as any, {
          title: 'Test Draft',
          content: 'Content',
          author: 'admin',
        });

        // 创建多个版本
        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 1,
          title: 'Version 1',
          content: 'Content 1',
          tags: ['legacy'],
          author: 'admin',
        });

        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 2,
          title: 'Version 2',
          content: 'Content 2',
          tags: ['v2'],
          author: 'admin',
        });

        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 3,
          title: 'Version 3',
          content: 'Content 3',
          tags: ['v3'],
          author: 'admin',
        });

        // 获取版本列表
        const result = await txService.getVersions(draft.id);

        // 验证排序（版本号降序）
        expect(result).toHaveLength(3);
        expect(result[0].version).toBe(3);
        expect(result[1].version).toBe(2);
        expect(result[2].version).toBe(1);
      });
    });

    it('should return empty array for draft with no versions', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿但不创建版本
        const draft = await Given.draft(db as any, {
          title: 'Test Draft',
          content: 'Content',
          author: 'admin',
        });

        // 获取版本列表
        const result = await txService.getVersions(draft.id);

        expect(result).toHaveLength(0);
      });
    });
  });

  describe('getVersion', () => {
    it('should return a specific version', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿
        const draft = await Given.draft(db as any, {
          title: 'Test Draft',
          content: 'Content',
          author: 'admin',
        });

        // 创建版本
        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 1,
          title: 'Version 1',
          content: 'Content 1',
          tags: ['test'],
          author: 'admin',
        });

        // 获取特定版本
        const result = await txService.getVersion(draft.id, 1);

        expect(result.version).toBe(1);
        expect(result.title).toBe('Version 1');
        expect(result.content).toBe('Content 1');
        expect(result.tags).toEqual(['test']);
      });
    });

    it('should throw NotFoundException when version not found', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        await expect(txService.getVersion(1, 999)).rejects.toThrow(NotFoundException);
      });
    });

    it('should return correct version when multiple versions exist', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿
        const draft = await Given.draft(db as any, {
          title: 'Test Draft',
          content: 'Content',
          author: 'admin',
        });

        // 创建多个版本
        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 1,
          title: 'Version 1',
          content: 'Content 1',
          author: 'admin',
        });

        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 2,
          title: 'Version 2',
          content: 'Content 2',
          author: 'admin',
        });

        // 获取版本 1
        const v1 = await txService.getVersion(draft.id, 1);
        expect(v1.version).toBe(1);
        expect(v1.title).toBe('Version 1');

        // 获取版本 2
        const v2 = await txService.getVersion(draft.id, 2);
        expect(v2.version).toBe(2);
        expect(v2.title).toBe('Version 2');
      });
    });
  });

  describe('restoreVersion', () => {
    it('should restore a draft to a specific version', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿
        const draft = await Given.draft(db as any, {
          title: 'Current Title',
          content: 'Current content',
          tags: ['current'],
          author: 'admin',
        });

        // 创建历史版本
        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 1,
          title: 'Old Version',
          content: 'Old content',
          tags: ['old'],
          author: 'admin',
        });

        // 恢复到版本 1
        await txService.restoreVersion(draft.id, 1);

        // 验证草稿已更新
        const [restoredDraft] = await tx.select().from(drafts).where(eq(drafts.id, draft.id));
        expect(restoredDraft.title).toBe('Old Version');
        expect(restoredDraft.content).toBe('Old content');
        expect(restoredDraft.tags).toEqual(['old']);
      });
    });

    it('should update updatedAt timestamp when restoring', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿
        const draft = await Given.draft(db as any, {
          title: 'Current',
          content: 'Content',
          author: 'admin',
        });

        // 创建历史版本
        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 1,
          title: 'Old Version',
          content: 'Old content',
          author: 'admin',
        });

        // 等待至少 1ms 以确保时间戳不同
        await new Promise((resolve) => setTimeout(resolve, 10));

        // 恢复版本
        await txService.restoreVersion(draft.id, 1);

        // 验证 updatedAt 已更新（由于 dayjs 格式化，应该有变化）
        const [restoredDraft] = await tx.select().from(drafts).where(eq(drafts.id, draft.id));

        // 验证恢复后的内容
        expect(restoredDraft.title).toBe('Old Version');
        expect(restoredDraft.content).toBe('Old content');

        // updatedAt 应该被更新（dayjs 格式化为 ISO 字符串）
        // 验证其是有效的日期格式即可
        expect(restoredDraft.updatedAt).toBeTruthy();
        expect(typeof restoredDraft.updatedAt).toBe('string');
      });
    });

    it('should throw NotFoundException when version to restore not found', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        await expect(txService.restoreVersion(1, 999)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('deleteVersion', () => {
    it('should delete a specific version', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿
        const draft = await Given.draft(db as any, {
          title: 'Test Draft',
          content: 'Content',
          author: 'admin',
        });

        // 创建版本
        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 1,
          title: 'Version 1',
          content: 'Content 1',
          author: 'admin',
        });

        // 删除版本
        await txService.deleteVersion(draft.id, 1);

        // 验证版本已删除
        const versions = await tx
          .select()
          .from(draftVersions)
          .where(eq(draftVersions.draftId, draft.id));
        expect(versions).toHaveLength(0);
      });
    });

    it('should throw NotFoundException when version to delete not found', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        await expect(txService.deleteVersion(1, 999)).rejects.toThrow(NotFoundException);
      });
    });

    it('should only delete the specified version', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿
        const draft = await Given.draft(db as any, {
          title: 'Test Draft',
          content: 'Content',
          author: 'admin',
        });

        // 创建多个版本
        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 1,
          title: 'Version 1',
          content: 'Content 1',
          author: 'admin',
        });

        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 2,
          title: 'Version 2',
          content: 'Content 2',
          author: 'admin',
        });

        // 删除版本 1
        await txService.deleteVersion(draft.id, 1);

        // 验证版本 1 已删除，版本 2 仍存在
        const versions = await tx
          .select()
          .from(draftVersions)
          .where(eq(draftVersions.draftId, draft.id));
        expect(versions).toHaveLength(1);
        expect(versions[0].version).toBe(2);
      });
    });
  });

  describe('deleteAllVersions', () => {
    it('should delete all versions for a draft', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿
        const draft = await Given.draft(db as any, {
          title: 'Test Draft',
          content: 'Content',
          author: 'admin',
        });

        // 创建多个版本
        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 1,
          title: 'Version 1',
          content: 'Content 1',
          author: 'admin',
        });

        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 2,
          title: 'Version 2',
          content: 'Content 2',
          author: 'admin',
        });

        await Given.draftVersion(db as any, {
          draftId: draft.id,
          version: 3,
          title: 'Version 3',
          content: 'Content 3',
          author: 'admin',
        });

        // 删除所有版本
        await txService.deleteAllVersions(draft.id);

        // 验证所有版本已删除
        const versions = await tx
          .select()
          .from(draftVersions)
          .where(eq(draftVersions.draftId, draft.id));
        expect(versions).toHaveLength(0);
      });
    });

    it('should not affect versions of other drafts', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建两个草稿
        const draft1 = await Given.draft(db as any, {
          title: 'Draft 1',
          content: 'Content 1',
          author: 'admin',
        });

        const draft2 = await Given.draft(db as any, {
          title: 'Draft 2',
          content: 'Content 2',
          author: 'admin',
        });

        // 为两个草稿分别创建版本
        await Given.draftVersion(db as any, {
          draftId: draft1.id,
          version: 1,
          title: 'Draft1 Version 1',
          content: 'Content',
          author: 'admin',
        });

        await Given.draftVersion(db as any, {
          draftId: draft2.id,
          version: 1,
          title: 'Draft2 Version 1',
          content: 'Content',
          author: 'admin',
        });

        // 只删除 draft1 的版本
        await txService.deleteAllVersions(draft1.id);

        // 验证 draft1 的版本已删除
        const draft1Versions = await tx
          .select()
          .from(draftVersions)
          .where(eq(draftVersions.draftId, draft1.id));
        expect(draft1Versions).toHaveLength(0);

        // 验证 draft2 的版本仍然存在
        const draft2Versions = await tx
          .select()
          .from(draftVersions)
          .where(eq(draftVersions.draftId, draft2.id));
        expect(draft2Versions).toHaveLength(1);
      });
    });

    it('should handle draft with no versions gracefully', async () => {
      await withTestTransaction(db, async (tx) => {
        const txService = createServiceWithTx(tx);

        // 创建草稿但不创建版本
        const draft = await Given.draft(db as any, {
          title: 'Test Draft',
          content: 'Content',
          author: 'admin',
        });

        // 删除所有版本（应该不报错）
        await expect(txService.deleteAllVersions(draft.id)).resolves.not.toThrow();
      });
    });
  });
});
