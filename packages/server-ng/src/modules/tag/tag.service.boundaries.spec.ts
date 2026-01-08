/**
 * TagService - Boundary Conditions and Edge Cases Tests
 *
 * Tests edge cases, boundary conditions, and special character handling
 * using real database with transaction rollback.
 *
 * Related tests:
 * - tag.service.spec.ts - Core CRUD operations
 * - tag.service.associations.spec.ts - Association queries
 * - tag.service.queries.spec.ts - Complex article queries
 */
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { tags } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import { db } from '@test/setup.unit';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { Mock } from '@test/mock';
import { Given } from '@test/given';

import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';

import { TagService } from './tag.service';

describe('TagService - Boundary Conditions', () => {
  let service: TagService;
  let mockHookService: ReturnType<typeof Mock.hook>;

  beforeEach(async () => {
    // 创建 Hook 服务 Mock
    mockHookService = Mock.hook();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
        {
          provide: QueryOptimizerService,
          useValue: {
            batchCountArticlesByTags: vi.fn().mockResolvedValue({}),
            withPerformanceMonitoring: vi.fn().mockImplementation(async (_name, fn) => fn()),
          },
        },
        {
          provide: StatisticsService,
          useValue: {
            getOverallStatistics: vi.fn().mockResolvedValue({
              totalCategories: 0,
              totalTags: 0,
              totalArticles: 0,
              publishedArticles: 0,
              privateArticles: 0,
              hiddenArticles: 0,
              totalViews: 0,
              categories: [],
              tags: [],
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TagService>(TagService);
  });

  describe('Empty and Null Values', () => {
    it('should accept empty string tag name (database allows it)', async () => {
      await withTestTransaction(db, async (tx) => {
        // 注入事务数据库
        service['db'] = tx;

        const createDto = {
          name: '', // Empty string - database allows this
          slug: 'test-slug',
        };

        // 数据库允许空字符串，但业务逻辑应该处理
        const result = await service.create(createDto);

        expect(result).toBeDefined();
        expect(result.name).toBe('');

        // 验证数据库持久化
        const [saved] = await tx.select().from(tags).where(eq(tags.id, result.id));
        expect(saved.name).toBe('');
      });
    });

    it('should reject null tag name', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: null as any, // null
          slug: 'test-slug',
        };

        await expect(service.create(createDto)).rejects.toThrow();
      });
    });

    it('should reject undefined tag name', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: undefined as any, // undefined
          slug: 'test-slug',
        };

        await expect(service.create(createDto)).rejects.toThrow();
      });
    });

    it('should accept empty string slug', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: 'Test Tag',
          slug: '', // Empty string - should be allowed
        };

        const result = await service.create(createDto);

        expect(result).toBeDefined();
        expect(result.slug).toBe('');

        // 验证数据库持久化
        const [saved] = await tx.select().from(tags).where(eq(tags.id, result.id));
        expect(saved.slug).toBe('');
      });
    });
  });

  describe('Very Long Strings', () => {
    it('should handle tag name exceeding 1000 characters', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const longName = 'a'.repeat(1001);
        const createDto = {
          name: longName,
          slug: 'test-slug',
        };

        const result = await service.create(createDto);

        expect(result.name).toBe(longName);
        expect(result.name.length).toBe(1001);

        // 验证数据库持久化
        const [saved] = await tx.select().from(tags).where(eq(tags.id, result.id));
        expect(saved.name).toBe(longName);
      });
    });

    it('should handle tag slug exceeding 1000 characters', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const longSlug = 'a'.repeat(1001);
        const createDto = {
          name: 'Test',
          slug: longSlug,
        };

        const result = await service.create(createDto);

        expect(result.slug).toBe(longSlug);
        expect(result.slug?.length).toBe(1001);

        // 验证数据库持久化
        const [saved] = await tx.select().from(tags).where(eq(tags.id, result.id));
        expect(saved.slug).toBe(longSlug);
      });
    });
  });

  describe('Special Characters', () => {
    it('should safely handle SQL injection attempt in name', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const sqlInjectionAttempt = "'; DROP TABLE tags; --";
        const createDto = {
          name: sqlInjectionAttempt,
          slug: 'test',
        };

        const result = await service.create(createDto);

        expect(result.name).toBe(sqlInjectionAttempt);

        // 验证数据库安全存储（表未被删除）
        const allTags = await tx.select().from(tags);
        expect(allTags).toHaveLength(1);
        expect(allTags[0].name).toBe(sqlInjectionAttempt);
      });
    });

    it('should handle tag with special characters', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const specialCharsName = '测试 Tag <>&"\'';
        const createDto = {
          name: specialCharsName,
          slug: 'test-special',
        };

        const result = await service.create(createDto);

        expect(result.name).toContain('测试');
        expect(result.name).toContain('&');

        // 验证数据库持久化
        const [saved] = await tx.select().from(tags).where(eq(tags.id, result.id));
        expect(saved.name).toBe(specialCharsName);
      });
    });

    it('should handle tag name with only whitespace', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const whitespaceOnly = '   \t\n  ';
        const createDto = {
          name: whitespaceOnly,
          slug: 'test',
        };

        const result = await service.create(createDto);

        expect(result.name).toBe(whitespaceOnly);

        // 验证数据库持久化
        const [saved] = await tx.select().from(tags).where(eq(tags.id, result.id));
        expect(saved.name).toBe(whitespaceOnly);
      });
    });

    it('should handle update with name containing emoji', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 先在事务中创建标签
        const mock = Mock.tag();
        const [created] = await tx
          .insert(tags)
          .values({
            ...mock,
            name: 'Original',
            slug: 'original',
          })
          .returning();

        const emojiName = 'Tag with emoji 😀🎉🚀';
        const updateDto = {
          name: emojiName,
        };

        const result = await service.update(created.id, updateDto);

        expect(result.name).toBe(emojiName);
        expect(result.name).toContain('😀');

        // 验证数据库持久化
        const [saved] = await tx.select().from(tags).where(eq(tags.id, created.id));
        expect(saved.name).toBe(emojiName);
      });
    });
  });

  describe('Duplicate Tags and Edge Cases', () => {
    it('should handle findOrCreateTags with very long tag names', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const longTagName = 'a'.repeat(1001);

        const result = await service.findOrCreateTags([longTagName]);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe(longTagName);

        // 验证数据库持久化
        const [saved] = await tx.select().from(tags).where(eq(tags.name, longTagName));
        expect(saved).toBeDefined();
        expect(saved.name).toBe(longTagName);
      });
    });

    it('should handle findOrCreateTags with duplicate names', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 先创建一个标签
        await Given.tag({
          name: 'DuplicateTag',
          slug: 'duplicate-tag',
        });

        // 尝试查找或创建重复的标签
        const result = await service.findOrCreateTags(['DuplicateTag', 'DuplicateTag']);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('DuplicateTag');

        // 验证数据库只有一个标签
        const allTags = await tx.select().from(tags);
        expect(allTags).toHaveLength(1);
      });
    });

    it('should handle tags with case-sensitive names (with unique slug constraint)', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 注意：数据库中 slug 字段有唯一约束
        // findOrCreateTags 会将 name 转换为小写作为 slug
        // 所以 'Python' 和 'PYTHON' 会有相同的 slug ('python')
        // 第二个插入会因为 slug 唯一约束而失败

        // 先创建一个标签
        await service.create({
          name: 'Python',
          slug: 'python',
        });

        // 尝试创建另一个标签，name 不同但 slug 会相同
        // 这应该会失败或被处理
        await expect(
          service.create({
            name: 'PYTHON',
            slug: 'python', // 相同的 slug
          }),
        ).rejects.toThrow();
      });
    });

    it('should handle findOrCreateTags with existing tags', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 先创建标签
        await Given.tag({
          name: 'ExistingTag',
          slug: 'existing-tag',
        });

        // 查找或创建（应该找到已存在的）
        const result = await service.findOrCreateTags(['ExistingTag']);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('ExistingTag');

        // 验证数据库没有重复
        const allTags = await tx.select().from(tags);
        expect(allTags).toHaveLength(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundException for non-existent ID in findOne', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
        await expect(service.findOne(999)).rejects.toThrow('Tag with ID 999 not found');
      });
    });

    it('should throw NotFoundException for non-existent ID in update', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        await expect(service.update(999, { name: 'Updated' })).rejects.toThrow(
          NotFoundException,
        );
        await expect(service.update(999, { name: 'Updated' })).rejects.toThrow(
          'Tag with ID 999 not found',
        );
      });
    });

    it('should throw NotFoundException for non-existent ID in remove', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        await expect(service.remove(999)).rejects.toThrow(NotFoundException);
        await expect(service.remove(999)).rejects.toThrow('Tag with ID 999 not found');
      });
    });

    it('should return null for non-existent tag name in findByName', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const result = await service.findByName('NonExistentTag');

        expect(result).toBeNull();
      });
    });
  });

  describe('Database Constraints', () => {
    it('should enforce tag name uniqueness implicitly', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 创建第一个标签
        await service.create({
          name: 'UniqueTag',
          slug: 'unique-tag',
        });

        // 尝试创建同名标签（应该由业务逻辑处理）
        const result = await service.findOrCreateTags(['UniqueTag']);

        // 应该返回已存在的标签，而不是创建新的
        expect(result).toHaveLength(1);

        // 验证数据库只有一个标签
        const allTags = await tx.select().from(tags);
        expect(allTags).toHaveLength(1);
      });
    });

    it('should handle bulk tag creation with findOrCreateTags', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const tagNames = ['Tag1', 'Tag2', 'Tag3', 'Tag4', 'Tag5'];

        const result = await service.findOrCreateTags(tagNames);

        expect(result).toHaveLength(5);

        // 验证数据库持久化
        const allTags = await tx.select().from(tags);
        expect(allTags).toHaveLength(5);

        const savedNames = allTags.map((t) => t.name).sort();
        expect(savedNames).toEqual(tagNames.sort());
      });
    });
  });

  describe('Edge Cases with Real Data', () => {
    it('should handle tag with null and empty slug correctly', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 创建 slug 为 null 的标签
        const tag1 = await Given.tag({
          name: 'TagWithNullSlug',
          slug: null,
        });

        // 创建 slug 为空字符串的标签
        const tag2 = await Given.tag({
          name: 'TagWithEmptySlug',
          slug: '',
        });

        // 验证查询结果
        const result1 = await service.findOne(tag1.id);
        expect(result1.slug).toBeUndefined();

        const result2 = await service.findOne(tag2.id);
        expect(result2.slug).toBe('');
      });
    });

    it('should handle concurrent tag operations', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 并发创建多个标签
        const createPromises = Array.from({ length: 10 }, (_, i) =>
          service.create({
            name: `ConcurrentTag${i}`,
            slug: `concurrent-tag-${i}`,
          }),
        );

        const results = await Promise.all(createPromises);

        expect(results).toHaveLength(10);

        // 验证数据库持久化
        const allTags = await tx.select().from(tags);
        expect(allTags).toHaveLength(10);
      });
    });

    it('should handle tag creation with maximum allowed fields', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const maxLength = 10000;
        const longName = 'a'.repeat(maxLength);
        const longSlug = 'b'.repeat(maxLength);

        const result = await service.create({
          name: longName,
          slug: longSlug,
        });

        expect(result.name.length).toBe(maxLength);
        expect(result.slug?.length).toBe(maxLength);

        // 验证数据库持久化
        const [saved] = await tx.select().from(tags).where(eq(tags.id, result.id));
        expect(saved.name.length).toBe(maxLength);
        expect(saved.slug?.length).toBe(maxLength);
      });
    });
  });
});
