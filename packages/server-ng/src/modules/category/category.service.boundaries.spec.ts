/**
 * CategoryService - Boundary Conditions Tests
 *
 * 测试分类服务的边界条件与特殊情况：
 * - 空值与 null 值处理
 * - 超长字符串（name, slug, description）
 * - 特殊字符（Unicode、Emoji、SQL 注入尝试）
 * - 仅包含空白字符的字符串
 * - 私有分类的边界值（超长密码、空密码）
 * - 唯一性约束验证
 * - 密码验证逻辑
 *
 * @module CategoryService
 * @group boundaries
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { categories } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import { db } from '@test/setup.unit';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { Mock } from '@test/mock';
import { Given } from '@test/given';

import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { CategoryService } from './category.service';

describe('CategoryService - Boundary Conditions', () => {
  let service: CategoryService;
  let mockHookService: ReturnType<typeof Mock.hook>;

  beforeEach(async () => {
    // 创建 Hook 服务 Mock
    mockHookService = Mock.hook();

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        CategoryService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
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
        {
          provide: QueryOptimizerService,
          useValue: {
            withPerformanceMonitoring: vi.fn().mockImplementation((_name, fn) => fn()),
            batchCountArticlesByTags: vi.fn().mockResolvedValue(new Map()),
            batchCountArticlesByCategories: vi.fn().mockResolvedValue(new Map()),
            buildOptimizedSearchQuery: vi.fn().mockReturnValue([]),
            logSlowQuery: vi.fn(),
          },
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
        {
          provide: ConfigService,
          useValue: Mock.config({ 'jwt.secret': 'test-secret-key' }),
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('Empty and Null Values', () => {
    it('should handle empty string category name', async () => {
      await withTestTransaction(db, async (tx) => {
        // 注入事务数据库
        service['db'] = tx;

        const createDto = {
          name: '', // Empty string
          slug: 'test-slug',
          description: 'Test',
        };

        const result = await service.create(createDto);

        expect(result).toBeDefined();
        expect(result.name).toBe('');

        // 验证数据库持久化
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.name).toBe('');
      });
    });

    it('should reject null category name', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: null as any, // null
          slug: 'test-slug',
          description: 'Test',
        };

        await expect(service.create(createDto)).rejects.toThrow();
      });
    });

    it('should reject undefined category name', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: undefined as any, // undefined
          slug: 'test-slug',
          description: 'Test',
        };

        await expect(service.create(createDto)).rejects.toThrow();
      });
    });

    it('should accept empty string slug', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: 'Test Category',
          slug: '', // Empty string
          description: 'Test',
        };

        const result = await service.create(createDto);

        expect(result).toBeDefined();
        expect(result.slug).toBe('');

        // 验证数据库持久化
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.slug).toBe('');
      });
    });

    it('should handle null description', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: 'Test Category',
          slug: 'test-slug',
          description: null as any,
        };

        const result = await service.create(createDto);

        expect(result).toBeDefined();
        expect(result.description).toBeNull();

        // 验证数据库持久化
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.description).toBeNull();
      });
    });
  });

  describe('Very Long Strings', () => {
    it('should handle category name exceeding 1000 characters', async () => {
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
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.name).toBe(longName);
        expect(saved.name.length).toBe(1001);
      });
    });

    it('should handle category slug exceeding 1000 characters', async () => {
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
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.slug).toBe(longSlug);
        expect(saved.slug?.length).toBe(1001);
      });
    });

    it('should handle category description exceeding 5000 characters', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const longDesc = 'Lorem ipsum dolor sit amet. '.repeat(200);
        const createDto = {
          name: 'Test',
          description: longDesc,
        };

        const result = await service.create(createDto);

        expect(result.description).toBe(longDesc);

        // 验证数据库持久化
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.description).toBe(longDesc);
      });
    });
  });

  describe('Special Characters', () => {
    it('should handle category with SQL injection attempt in name', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const sqlInjectionAttempt = "'; DROP TABLE categories; --";
        const createDto = {
          name: sqlInjectionAttempt,
          slug: 'test',
        };

        const result = await service.create(createDto);

        expect(result.name).toBe(sqlInjectionAttempt);

        // 验证数据库安全存储（表未被删除）
        const allCategories = await tx.select().from(categories);
        expect(allCategories).toHaveLength(1);
        expect(allCategories[0].name).toBe(sqlInjectionAttempt);
      });
    });

    it('should handle category with special characters', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const specialCharsName = '测试 Category <>&"\'';
        const createDto = {
          name: specialCharsName,
          slug: 'test-special',
        };

        const result = await service.create(createDto);

        expect(result.name).toContain('测试');
        expect(result.name).toContain('&');

        // 验证数据库持久化
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.name).toBe(specialCharsName);
      });
    });

    it('should handle category name with only whitespace', async () => {
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
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.name).toBe(whitespaceOnly);
      });
    });

    it('should handle update with name containing emoji', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 先创建分类
        const created = await Given.category({
          name: 'Original',
          slug: 'original',
        });

        const emojiName = 'Category with emoji 😀🎉🚀';
        const updateDto = {
          name: emojiName,
        };

        const result = await service.update(created.id, updateDto);

        expect(result.name).toBe(emojiName);
        expect(result.name).toContain('😀');

        // 验证数据库持久化
        const [saved] = await tx.select().from(categories).where(eq(categories.id, created.id));
        expect(saved.name).toBe(emojiName);
      });
    });
  });

  describe('Private Categories', () => {
    it('should handle private category with very long password', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const longPassword = 'p'.repeat(1000);
        const createDto = {
          name: 'Private Category',
          private: true,
          password: longPassword,
        };

        const result = await service.create(createDto);

        expect(result.private).toBe(true);
        expect(result.password).not.toBe(longPassword); // 密码应该被哈希

        // 验证数据库持久化
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.private).toBe(true);
        expect(saved.password).not.toBe(longPassword); // 密码应该被哈希
        expect(saved.password).toMatch(/^\$2[aby]\$/); // bcrypt 哈希格式
      });
    });

    it('should handle private category with empty password', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: 'Private Category Empty',
          private: true,
          password: '',
        };

        const result = await service.create(createDto);

        expect(result).toBeDefined();
        expect(result.private).toBe(true);
        // 空字符串密码会被保留（因为 '' 是假值，不会触发哈希）
        expect(result.password).toBe('');

        // 验证数据库持久化
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.private).toBe(true);
        expect(saved.password).toBe('');
      });
    });

    it('should verify password correctly for private category', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const password = 'correct-password';
        const createDto = {
          name: 'Private Category',
          private: true,
          password,
        };

        const category = await service.create(createDto);

        // 验证正确密码
        const result1 = await service.verifyPassword(category.id, password);
        expect(result1.success).toBe(true);
        expect(result1.token).toBeDefined();

        // 验证错误密码
        const result2 = await service.verifyPassword(category.id, 'wrong-password');
        expect(result2.success).toBe(false);
        expect(result2.message).toBe('Invalid password');
      });
    });

    it('should allow access to non-private category without password', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: 'Public Category',
          private: false,
        };

        const category = await service.create(createDto);

        // 非私有分类不需要密码
        const result = await service.verifyPassword(category.id, 'any-password');
        expect(result.success).toBe(true);
        expect(result.message).toBe('Category is not private');
      });
    });
  });

  describe('Database Constraints', () => {
    it('should enforce category name uniqueness at database level', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const categoryName = 'UniqueCategory';

        // 创建第一个分类
        await service.create({
          name: categoryName,
          slug: 'unique-category-1',
        });

        // 尝试创建同名分类（不同 slug）
        // 数据库有 name 的唯一约束，所以这应该失败
        await expect(
          service.create({
            name: categoryName,
            slug: 'unique-category-2',
          }),
        ).rejects.toThrow();

        // 验证数据库中只有一个分类
        const allCategories = await tx.select().from(categories);
        expect(allCategories).toHaveLength(1);
        expect(allCategories[0].name).toBe(categoryName);
      });
    });

    it('should handle concurrent category operations', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 并发创建多个分类
        const createPromises = Array.from({ length: 10 }, (_, i) =>
          service.create({
            name: `ConcurrentCategory${i}`,
            slug: `concurrent-category-${i}`,
          }),
        );

        const results = await Promise.all(createPromises);

        expect(results).toHaveLength(10);

        // 验证数据库持久化
        const allCategories = await tx.select().from(categories);
        expect(allCategories).toHaveLength(10);
      });
    });
  });

  describe('Edge Cases with Real Data', () => {
    it('should handle category with null and empty slug correctly', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 创建 slug 为 null 的分类
        const [category1] = await tx
          .insert(categories)
          .values({
            name: 'CategoryWithNullSlug',
            slug: null,
          })
          .returning();

        // 创建 slug 为空字符串的分类
        const [category2] = await tx
          .insert(categories)
          .values({
            name: 'CategoryWithEmptySlug',
            slug: '',
          })
          .returning();

        // 验证查询结果
        const result1 = await service.findOne(category1.id);
        expect(result1.slug).toBeNull();

        const result2 = await service.findOne(category2.id);
        expect(result2.slug).toBe('');
      });
    });

    it('should handle updating category from private to public', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 创建私有分类
        const [created] = await tx
          .insert(categories)
          .values({
            name: 'Private Category',
            slug: 'private',
            private: true,
            password: 'password',
          })
          .returning();

        // 更新为公开分类
        const result = await service.update(created.id, {
          name: 'Public Category',
        });

        expect(result.name).toBe('Public Category');
        // private 和 password 字段不会在 update 中改变，除非明确提供

        // 验证数据库持久化
        const [saved] = await tx.select().from(categories).where(eq(categories.id, created.id));
        expect(saved.name).toBe('Public Category');
      });
    });

    it('should handle category with all optional fields null', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: 'Minimal Category',
          slug: null as any,
          description: null as any,
          private: null as any,
          password: null as any,
        };

        const result = await service.create(createDto);

        expect(result.name).toBe('Minimal Category');
        expect(result.slug).toBeNull();
        expect(result.description).toBeNull();
        expect(result.private).toBeNull();
        expect(result.password).toBeNull();

        // 验证数据库持久化
        const [saved] = await tx.select().from(categories).where(eq(categories.id, result.id));
        expect(saved.name).toBe('Minimal Category');
        expect(saved.slug).toBeNull();
        expect(saved.description).toBeNull();
        expect(saved.private).toBeNull();
        expect(saved.password).toBeNull();
      });
    });
  });
});
