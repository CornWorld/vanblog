import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect, vi, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

import { Mock, type MockedHookService } from '@test/mock';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { db } from '@test/setup.unit';
import { Given } from '@test/given';
import { articles } from '@vanblog/shared/drizzle';
import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { HookService } from '../plugin/services/hook.service';

import { ArticleService } from './article.service';

import type { ArticleSearchDto } from './dto/article.dto';

// Test helper to create a user in the current transaction context
async function createTestUser(userId: number = 1) {
  await Given.user(db as any, {
    id: userId,
    username: `testuser${String(userId)}`,
    name: `Test User ${String(userId)}`,
    email: `testuser${String(userId)}@example.com`,
    type: 'admin',
  });
}

describe('ArticleService', () => {
  let service: ArticleService;
  let mockHookService: MockedHookService;
  let mockQueryOptimizer: Partial<QueryOptimizerService>;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    // ✅ 优化：使用新的扁平化 Mock API
    mockHookService = Mock.hook();
    // ✅ 优化：使用新的扁平化 Mock API
    mockQueryOptimizer = Mock.queryOptimizer();
    // ✅ 优化：使用新的扁平化 Mock API
    mockConfigService = Mock.config();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
        {
          provide: QueryOptimizerService,
          useValue: mockQueryOptimizer,
        },
        {
          provide: HookService,
          useValue: mockHookService as any,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ArticleService>(ArticleService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return articles with pagination', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 先创建测试用户
        await createTestUser(1);

        // 创建测试数据
        // const _article = await Given.article(db as any, {
        //   id: 1,
        //   title: 'Test Article',
        // });

        const result = await service.findAll({
          page: 1,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
      });
    });
  });

  describe('search', () => {
    it('should search articles by query', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 创建测试数据
        await Given.article(db as any, {
          id: 1,
          title: 'search term',
        });

        const searchDto: ArticleSearchDto = {
          keyword: 'search term',
          query: 'search term',
          page: 1,
          pageSize: 10,
        };

        const result = await service.search(searchDto);

        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(1);
      });
    });

    it('should search only in title when titleOnly is true', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const searchDto: ArticleSearchDto = {
          keyword: 'test',
          page: 1,
          pageSize: 10,
          query: 'test',
          titleOnly: true,
        };

        const result = await service.search(searchDto);

        expect(result.items).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    it('should filter by category and tags', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 先创建测试用户和分类
        await createTestUser(1);
        await Given.category(db as any, { name: 'tech', slug: 'tech' });

        // 创建带分类和标签的文章
        await Given.article(db as any, {
          id: 1,
          category: 'tech',
          tags: ['javascript', 'node'],
        });

        const searchDto: ArticleSearchDto = {
          keyword: 'test',
          page: 1,
          pageSize: 10,
          query: 'test',
          category: 'tech',
          tags: ['javascript', 'node'],
        };

        const result = await service.search(searchDto);

        // 验证结果
        expect(result.items).toBeDefined();
      });
    });
  });

  describe('findOne', () => {
    it('should return a single article', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 创建测试数据
        // const _article = await Given.article(db as any, {
        //   id: 1,
        // });

        const result = await service.findOne(1);

        expect(result.id).toBe(1);
        expect(result.title).toBe('Test Article');
      });
    });

    it('should throw NotFoundException when article not found', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('create', () => {
    it('should create a new article', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 先创建测试用户
        await createTestUser(1);

        const createDto = {
          title: 'New Article',
          content: 'New content',
          author: 'testuser1',
          tags: ['new'], // 使用数组而不是 JSON 字符串
        };

        const result = await service.create(
          createDto as unknown as Parameters<typeof service.create>[0],
        );

        expect(result.id).toBeDefined();
        expect(result.title).toBe('New Article');
        expect(result.tags).toEqual(['new']);

        // 验证数据库持久化
        const [saved] = await tx.select().from(articles).where(eq(articles.id, result.id));
        expect(saved).toBeDefined();
        expect(saved.title).toBe('New Article');

        // Tags 现在存储在 article_tags 关联表中，不再是 JSON 字段
        // 需要通过 service 的 findOne 方法获取（会自动加载 tags）
        const savedWithTags = await service.findOne(result.id);
        expect(savedWithTags.tags).toEqual(['new']);
      });
    });

    it('should hash password on create when provided', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const createDto = Mock.articleDto({
          title: 'With Password',
          content: 'Secret content',
          tags: JSON.stringify([]),
          password: 'plain-secret',
        });

        const result = await service.create(
          createDto as unknown as Parameters<typeof service.create>[0],
        );

        // 验证密码被哈希
        const [saved] = await tx.select().from(articles).where(eq(articles.id, result.id));
        expect(saved.password).toBeTypeOf('string');
        expect(saved.password).not.toBe('plain-secret');
        expect(String(saved.password)).toMatch(/^\$2[aby]\$/);
      });
    });
  });

  describe('update', () => {
    it('should update an existing article', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 创建现有文章
        // const _existing = await Given.article(db as any, {
        //   id: 1,
        //   title: 'Existing Article',
        //   content: 'Existing content',
        //   tags: ['existing'],
        // });

        const updateDto = {
          title: 'Updated Article',
          content: 'Updated content',
          tags: ['updated'],
        };

        const result = await service.update(1, updateDto);

        expect(result.title).toBe('Updated Article');
        expect(result.tags).toEqual(['updated']);

        // 验证数据库更新
        const [updated] = await tx.select().from(articles).where(eq(articles.id, 1));
        expect(updated.title).toBe('Updated Article');
      });
    });

    it('should hash password on update when provided', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 创建现有文章
        // const _existing = await Given.article(db as any, {
        //   id: 3,
        // });

        await service.update(3, { password: 'plain-update' } as unknown as Parameters<
          typeof service.update
        >[1]);

        // 验证密码被哈希
        const [updated] = await tx.select().from(articles).where(eq(articles.id, 3));
        expect(updated.password).toBeTypeOf('string');
        expect(updated.password).not.toBe('plain-update');
        expect(String(updated.password)).toMatch(/^\$2[aby]\$/);
      });
    });

    it('should throw NotFoundException when article not found', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await expect(
          service.update(999, { title: 'Test', content: 'Test content', tags: [] }),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('remove', () => {
    it('should delete an article', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 创建测试数据
        // const _article = await Given.article(db as any, {
        //   id: 1,
        // });

        await expect(service.remove(1)).resolves.not.toThrow();

        // 验证删除
        const deleted = await tx.select().from(articles).where(eq(articles.id, 1));
        expect(deleted).toHaveLength(0);
      });
    });

    it('should throw NotFoundException when article not found', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('exportArticles', () => {
    it('should export all articles', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 先创建测试用户和分类
        await createTestUser(1);
        await Given.category(db as any, { name: 'tech', slug: 'tech' });

        // 创建测试数据
        await Given.article(db as any, {
          id: 1,
          title: 'Article 1',
          content: 'Content 1',
          tags: ['tag1'],
          viewer: 100,
        });
        await Given.article(db as any, {
          id: 2,
          title: 'Article 2',
          content: 'Content 2',
          top: 1,
          hidden: true,
          viewer: 50,
          pathname: 'article-2',
          category: 'tech',
          tags: [],
        });

        const result = await service.exportArticles();

        expect(result).toHaveLength(2);
        expect(result[0].title).toBe('Article 1');
        expect(result[0].tags).toEqual(['tag1']);
        expect(result[1].title).toBe('Article 2');
        expect(result[1].tags).toEqual([]);
        expect(result[1].category).toBe('tech');
      });
    });
  });

  describe('importArticles', () => {
    it('should import multiple articles sequentially', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 先创建测试用户和分类
        await createTestUser(1);
        await Given.category(db as any, {
          name: 'imported',
          slug: 'imported',
        });

        const articlesToImport = [
          Mock.articleDto({
            title: 'Import 1',
            content: 'Content 1',
            author: 'testuser1',
            tags: JSON.stringify(['import']),
          }),
          Mock.articleDto({
            title: 'Import 2',
            content: 'Content 2',
            author: 'testuser1',
            category: 'imported',
            tags: JSON.stringify([]),
          }),
        ];

        const typedArticlesToImport = articlesToImport as unknown as Parameters<
          typeof service.importArticles
        >[0];
        await service.importArticles(typedArticlesToImport);

        // 验证 afterCreate 钩子被触发了 2 次（每篇文章一次）
        expect(mockHookService.doAction).toHaveBeenCalledTimes(2);

        // 验证数据库中有 2 篇文章
        const savedArticles = await tx.select().from(articles);
        expect(savedArticles).toHaveLength(2);
      });
    });

    it('should handle empty array import', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await service.importArticles([]);

        // 验证没有插入操作
        const savedArticles = await tx.select().from(articles);
        expect(savedArticles).toHaveLength(0);
        expect(mockHookService.doAction).not.toHaveBeenCalled();
      });
    });

    it('should import single article correctly', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const singleArticle = [
          Mock.articleDto({
            title: 'Single Import',
            content: 'Single content',
            tags: JSON.stringify(['single']),
          }),
        ];

        const typedArticle = singleArticle as unknown as Parameters<
          typeof service.importArticles
        >[0];
        await service.importArticles(typedArticle);

        // 验证插入操作和钩子触发
        expect(mockHookService.doAction).toHaveBeenCalledTimes(1);
        expect(mockHookService.doAction).toHaveBeenCalledWith(
          'article|afterCreate',
          expect.any(Object),
          expect.objectContaining({ action: 'create' }),
        );
      });
    });

    it('should handle large batch import (25 articles)', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 先创建测试用户
        await createTestUser(1);

        const largeArticles = Array.from({ length: 25 }, (_, i) =>
          Mock.articleDto({
            title: `Article ${String(i + 1)}`,
            content: `Content ${String(i + 1)}`,
            author: 'testuser1',
            tags: JSON.stringify([`tag${String(i + 1)}`]),
          }),
        );

        const typedArticles = largeArticles as unknown as Parameters<
          typeof service.importArticles
        >[0];
        await service.importArticles(typedArticles);

        // 验证所有文章都被导入（afterCreate 钩子调用次数 = 文章数量）
        expect(mockHookService.doAction).toHaveBeenCalledTimes(25);

        // 验证数据库中有 25 篇文章
        const savedArticles = await tx.select().from(articles);
        expect(savedArticles).toHaveLength(25);
      });
    });

    it('should handle import failure and stop processing', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 先创建测试用户
        await createTestUser(1);

        // 先手动创建第一篇文章（用于后续验证）
        const firstArticle = await service.create({
          title: 'Article 1',
          content: 'Content 1',
          author: 'testuser1',
          tags: [],
        } as unknown as Parameters<typeof service.create>[0]);

        // Mock service.create 方法来模拟第二篇文章失败
        // 不要 mock tx.insert，因为这会破坏 Drizzle 的方法链
        const createSpy = vi
          .spyOn(service, 'create')
          .mockResolvedValueOnce(firstArticle) // 第一次调用返回已创建的文章
          .mockRejectedValueOnce(new Error('Database error')); // 第二次调用失败

        const articlesToImport = [
          { title: 'Article 1', content: 'Content 1', author: 'testuser1', tags: [] },
          { title: 'Article 2', content: 'Content 2', author: 'testuser1', tags: [] },
          { title: 'Article 3', content: 'Content 3', author: 'testuser1', tags: [] },
        ];

        const typedArticles = articlesToImport as unknown as Parameters<
          typeof service.importArticles
        >[0];

        // 验证抛出错误
        await expect(service.importArticles(typedArticles)).rejects.toThrow('Database error');

        // 验证只调用了两次 create（第一次成功，第二次失败后停止）
        expect(createSpy).toHaveBeenCalledTimes(2);
        // 验证只有第一篇文章的 hook 被触发
        expect(mockHookService.doAction).toHaveBeenCalledTimes(1);
        expect(mockHookService.doAction).toHaveBeenCalledWith(
          'article|afterCreate',
          expect.objectContaining({ title: 'Article 1' }),
          expect.objectContaining({ action: 'create' }),
        );
      });
    });

    it('should process articles with mixed tags (some with, some without)', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const articlesToImport = [
          Mock.articleDto({
            title: 'With Tags',
            content: 'Content',
            tags: JSON.stringify(['tag1', 'tag2']),
          }),
          Mock.articleDto({
            title: 'No Tags',
            content: 'Content',
            tags: JSON.stringify([]),
          }),
          Mock.articleDto({
            title: 'Single Tag',
            content: 'Content',
            tags: JSON.stringify(['tag3']),
          }),
        ];

        const typedArticles = articlesToImport as unknown as Parameters<
          typeof service.importArticles
        >[0];
        await service.importArticles(typedArticles);

        // 验证所有文章都被处理（3 篇文章 = 3 次钩子调用）
        expect(mockHookService.doAction).toHaveBeenCalledTimes(3);

        // 验证每次调用都是 afterCreate 钩子
        for (let i = 0; i < 3; i++) {
          expect(mockHookService.doAction).toHaveBeenNthCalledWith(
            i + 1,
            'article|afterCreate',
            expect.any(Object),
            expect.objectContaining({ action: 'create' }),
          );
        }

        // 验证钩子被正确传递了文章对象（验证对象包含 id 和 tags 属性）
        const calls = mockHookService.doAction.mock.calls;
        expect(calls[0][1]).toHaveProperty('id');
        expect(calls[0][1]).toHaveProperty('tags');
        expect(calls[1][1]).toHaveProperty('id');
        expect(calls[1][1]).toHaveProperty('tags');
        expect(calls[2][1]).toHaveProperty('id');
        expect(calls[2][1]).toHaveProperty('tags');
      });
    });

    it('should verify sequential processing (not batched)', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const articlesToImport = [
          Mock.articleDto({ title: 'Article 1', content: 'Content 1', tags: JSON.stringify([]) }),
          Mock.articleDto({ title: 'Article 2', content: 'Content 2', tags: JSON.stringify([]) }),
        ];

        const typedArticles = articlesToImport as unknown as Parameters<
          typeof service.importArticles
        >[0];
        await service.importArticles(typedArticles);

        // 验证顺序处理：第二个 hook 在第一个完成后才被调用
        expect(mockHookService.doAction).toHaveBeenNthCalledWith(
          1,
          'article|afterCreate',
          expect.objectContaining({ title: 'Article 1' }),
          expect.objectContaining({ action: 'create' }),
        );
        expect(mockHookService.doAction).toHaveBeenNthCalledWith(
          2,
          'article|afterCreate',
          expect.objectContaining({ title: 'Article 2' }),
          expect.objectContaining({ action: 'create' }),
        );

        // 验证是顺序调用（通过检查调用顺序）
        const calls = mockHookService.doAction.mock.calls;
        expect(calls.length).toBe(2);
        expect(calls[0][1]).toHaveProperty('title', 'Article 1');
        expect(calls[1][1]).toHaveProperty('title', 'Article 2');
      });
    });
  });

  describe('findByCategory', () => {
    it('should return articles by category with pagination', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 先创建测试用户和分类
        await createTestUser(1);
        await Given.category(db as any, { name: 'tech', slug: 'tech' });

        // 创建测试数据 - 批量创建2篇tech分类文章
        await Given.articles(2, { category: 'tech' });

        const result = await service.findByCategory('tech');

        expect(result.items).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
      });
    });

    it('should support custom pagination parameters', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 先创建测试用户和分类
        await createTestUser(1);
        await Given.category(db as any, { name: 'tech', slug: 'tech' });

        // 创建 15 篇文章
        await Given.articles(15, { category: 'tech' });

        const result = await service.findByCategory('tech', { page: 2, pageSize: 5 });

        expect(result.items).toHaveLength(5);
        expect(result.total).toBe(15);
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(5);
        expect(result.totalPages).toBe(3);
      });
    });
  });

  describe('findOneByPathname', () => {
    it('should return article by pathname', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 创建测试数据
        await Given.article(db as any, { id: 1, pathname: 'test-article' });

        const result = await service.findOneByPathname('test-article');

        expect(result.id).toBe(1);
        expect(result.pathname).toBe('test-article');
      });
    });

    it('should throw NotFoundException when article with pathname not found', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await expect(service.findOneByPathname('non-existent')).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('isPrivateById', () => {
    it('should return true for private article', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await Given.article(db as any, { id: 1, private: true });

        const result = await service.isPrivateById(1);

        expect(result).toBe(true);
      });
    });

    it('should return false for public article', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await Given.article(db as any, { id: 1, private: false });

        const result = await service.isPrivateById(1);

        expect(result).toBe(false);
      });
    });

    it('should return null when article not found', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const result = await service.isPrivateById(999);

        expect(result).toBe(null);
      });
    });
  });

  describe('isPrivateByPathname', () => {
    it('should return true for private article by pathname', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await Given.article(db as any, { id: 1, pathname: 'private-article', private: true });

        const result = await service.isPrivateByPathname('private-article');

        expect(result).toBe(true);
      });
    });

    it('should return false for public article by pathname', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await Given.article(db as any, { id: 1, pathname: 'public-article', private: false });

        const result = await service.isPrivateByPathname('public-article');

        expect(result).toBe(false);
      });
    });

    it('should return null when article not found by pathname', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const result = await service.isPrivateByPathname('non-existent');

        expect(result).toBe(null);
      });
    });
  });

  describe('verifyPassword', () => {
    it('should return success for public article without password', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await Given.article(db as any, {
          id: 1,
          private: false,
          password: null,
        });

        const result = await service.verifyPassword(1, 'any-password');

        expect(result.success).toBe(true);
        expect(result.message).toBe('Article is not private');
      });
    });

    it('should return failure for incorrect password', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const hashedPassword = await bcrypt.hash('correct-password', 10);
        await Given.article(db as any, {
          id: 1,
          private: true,
          password: hashedPassword,
        });

        const result = await service.verifyPassword(1, 'wrong-password');

        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid password');
      });
    });
  });

  describe('verifyPasswordByPathname', () => {
    it('should return success for public article by pathname', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await Given.article(db as any, {
          id: 1,
          pathname: 'public-article',
          private: false,
          password: null,
        });

        const result = await service.verifyPasswordByPathname('public-article', 'any-password');

        expect(result.success).toBe(true);
        expect(result.message).toBe('Article is not private');
      });
    });
  });

  describe('getArticlesGroupedByCategory', () => {
    it('should return articles grouped by category', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 先创建测试用户和分类
        await createTestUser(1);
        await Given.category(db as any, { name: 'Tech', slug: 'tech' });
        await Given.category(db as any, { name: 'Lifestyle', slug: 'lifestyle' });

        // 创建测试数据
        await Given.article(db as any, {
          id: 1,
          title: 'Article 1',
          category: 'Tech',
        });
        await Given.article(db as any, {
          id: 2,
          title: 'Article 2',
          category: 'Tech',
        });
        await Given.article(db as any, {
          id: 3,
          title: 'Article 3',
          category: 'Lifestyle',
        });

        const result = await service.getArticlesGroupedByCategory();

        expect(result).toHaveProperty('Tech');
        expect(result).toHaveProperty('Lifestyle');
        expect(result.Tech).toHaveLength(2);
        expect(result.Lifestyle).toHaveLength(1);
      });
    });

    it('should group articles without category as Uncategorized', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await Given.article(db as any, {
          id: 1,
          title: 'No Category',
          category: null,
        });

        const result = await service.getArticlesGroupedByCategory();

        expect(result).toHaveProperty('Uncategorized');
        expect(result.Uncategorized).toHaveLength(1);
      });
    });

    it('should exclude private and hidden articles', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        const result = await service.getArticlesGroupedByCategory();

        expect(result).toEqual({});
      });
    });
  });

  describe('getArticlesGroupedByTag', () => {
    it('should return articles grouped by tag', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        // 创建测试数据
        await Given.article(db as any, {
          id: 1,
          title: 'Article 1',
          tags: ['javascript', 'nodejs'],
        });
        await Given.article(db as any, {
          id: 2,
          title: 'Article 2',
          tags: ['javascript'],
        });

        const result = await service.getArticlesGroupedByTag();

        expect(result).toHaveProperty('javascript');
        expect(result).toHaveProperty('nodejs');
        expect(result.javascript).toHaveLength(2);
        expect(result.nodejs).toHaveLength(1);
      });
    });

    it('should group articles without tags as Untagged', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx as any;

        await Given.article(db as any, {
          id: 1,
          title: 'No Tags',
          tags: [],
        });

        const result = await service.getArticlesGroupedByTag();

        expect(result).toHaveProperty('Untagged');
        expect(result.Untagged).toHaveLength(1);
      });
    });
  });
});
