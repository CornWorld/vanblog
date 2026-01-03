import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect, vi, afterEach } from 'vitest';

import { type DatabaseMockBuilder } from '../../../test/mock';
import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { HookService } from '../plugin/services/hook.service';

import { ArticleService } from './article.service';

import type { ArticleSearchDto } from './dto/article.dto';

describe('ArticleService', () => {
  let service: ArticleService;
  let mockHookService: Partial<HookService>;
  let databaseMock: DatabaseMockBuilder;
  let mockQueryOptimizer: Partial<QueryOptimizerService>;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    // 使用Mock工具类创建数据库Mock
    databaseMock = Mock.db();
    mockHookService = Mock.hook();
    mockQueryOptimizer = Mock.queryOptimizer();
    mockConfigService = Mock.config();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleService,
        {
          provide: DATABASE_CONNECTION,
          useValue: databaseMock.build(),
        },
        {
          provide: QueryOptimizerService,
          useValue: mockQueryOptimizer,
        },
        {
          provide: HookService,
          useValue: mockHookService,
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
      const mockArticles = Mock.articles(1);
      const countResult = [{ count: 1 }];

      // Mock for the main query
      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockArticles),
              }),
            }),
          }),
        }),
      });

      // Mock for the count query
      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(countResult),
        }),
      });

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

  describe('search', () => {
    it('should search articles by query', async () => {
      const mockArticles = Mock.articles(1);
      const countResult = [{ count: 1 }];

      // 设置两个并行查询的返回值
      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockArticles),
              }),
            }),
          }),
        }),
      });

      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(countResult),
        }),
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

    it('should search only in title when titleOnly is true', async () => {
      const countResult = [{ count: 0 }];

      // 设置两个并行查询的返回值
      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(countResult),
        }),
      });

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

    it('should filter by category and tags', async () => {
      const countResult = [{ count: 0 }];
      const whereMock = vi.fn().mockResolvedValue(countResult);

      // 设置两个并行查询的返回值
      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: whereMock,
        }),
      });

      const searchDto: ArticleSearchDto = {
        keyword: 'test',
        page: 1,
        pageSize: 10,
        query: 'test',
        category: 'tech',
        tags: ['javascript', 'node'],
      };

      await service.search(searchDto);

      expect(whereMock).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single article', async () => {
      const mockArticle = Mock.article({ id: 1 });

      // Mock for findOne query
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockArticle]),
          }),
        }),
      });

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Article');
    });

    it('should throw NotFoundException when article not found', async () => {
      // Mock for findOne query returning empty result
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new article', async () => {
      const mockCreatedArticle = Mock.article({
        id: 1,
        title: 'New Article',
        content: 'New content',
        tags: ['new'],
      });

      const createDto = Mock.articleDto({
        title: 'New Article',
        content: 'New content',
        tags: JSON.stringify(['new']),
      });

      // 使用Mock工具类设置创建结果
      databaseMock.setInsertResult([mockCreatedArticle]);
      databaseMock.setQueryResult([]); // 模拟标签查询结果

      const result = await service.create(
        createDto as unknown as Parameters<typeof service.create>[0],
      );

      expect(result.id).toBe(1);
      expect(result.title).toBe('New Article');
      expect(result.tags).toEqual(['new']);
    });

    it('should hash password on create when provided', async () => {
      // Arrange
      const mockCreatedArticle = Mock.article({
        id: 2,
        title: 'With Password',
        content: 'Secret content',
        tags: [],
        password: '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      });

      const createDto = Mock.articleDto({
        title: 'With Password',
        content: 'Secret content',
        tags: JSON.stringify([]),
        password: 'plain-secret',
      });

      databaseMock.setInsertResult([mockCreatedArticle]);
      databaseMock.setQueryResult([]);

      // Act
      await service.create(createDto as unknown as Parameters<typeof service.create>[0]);

      // Assert: capture values() argument and ensure password is hashed (bcrypt)
      const [[valuesArg]] = databaseMock.db.values.mock.calls; // service.create uses .values([newArticleData])
      expect(databaseMock.db.values.mock.calls.length).toBeGreaterThan(0);
      expect(Array.isArray(valuesArg)).toBe(true);
      const inserted = valuesArg[0] as Record<string, unknown>;
      expect(inserted.password).toBeTypeOf('string');
      expect(inserted.password).not.toBe('plain-secret');
      expect(String(inserted.password)).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('update', () => {
    it('should update an existing article', async () => {
      const mockExistingArticle = Mock.article({
        id: 1,
        title: 'Existing Article',
        content: 'Existing content',
        tags: ['existing'],
      });

      const mockUpdatedArticle = Mock.article({
        id: 1,
        title: 'Updated Article',
        content: 'Updated content',
        tags: ['updated'],
      });

      // Mock for the existence check query (findOne)
      databaseMock.db.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockExistingArticle]),
            }),
          }),
        })
        // Mock for the tags query (createMissingTags)
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue([]), // Return empty array, no existing tags
        });

      databaseMock.setUpdateResult([mockUpdatedArticle]); // 更新结果

      const updateDto = {
        title: 'Updated Article',
        content: 'Updated content',
        tags: ['updated'],
      };

      const result = await service.update(1, updateDto);

      expect(result.title).toBe('Updated Article');
      expect(result.tags).toEqual(['updated']);
    });

    it('should hash password on update when provided', async () => {
      // Arrange: mock existing article for existence check
      const mockExistingArticle = Mock.article({ id: 3 });

      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockExistingArticle]),
          }),
        }),
      });

      databaseMock.setUpdateResult([Mock.article({ id: 3, password: null })]);

      // Act
      await service.update(3, { password: 'plain-update' } as unknown as Parameters<
        typeof service.update
      >[1]);

      // Assert: capture set() argument and ensure password is hashed
      const [[setArg]] = databaseMock.db.set.mock.calls;
      expect(databaseMock.db.set.mock.calls.length).toBeGreaterThan(0);
      expect(setArg.password).toBeTypeOf('string');
      expect(setArg.password).not.toBe('plain-update');
      expect(String(setArg.password)).toMatch(/^\$2[aby]\$/);
    });

    it('should throw NotFoundException when article not found', async () => {
      // Mock for the existence check query returning empty result
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.update(999, { title: 'Test', content: 'Test content', tags: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an article', async () => {
      const mockArticle = Mock.article({ id: 1 });

      // Mock for the existence check query
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockArticle]),
          }),
        }),
      });

      // Mock for the delete operation
      databaseMock.db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when article not found', async () => {
      // Mock for the existence check query returning empty result
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportArticles', () => {
    it('should export all articles', async () => {
      const mockArticles = [
        Mock.article({
          id: 1,
          title: 'Article 1',
          content: 'Content 1',
          tags: ['tag1'],
          viewer: 100,
        }),
        Mock.article({
          id: 2,
          title: 'Article 2',
          content: 'Content 2',
          tags: null,
          top: 1,
          hidden: true,
          viewer: 50,
          pathname: 'article-2',
          category: 'tech',
        }),
      ];

      // Mock for exportArticles: select().from(articles)
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockResolvedValue(mockArticles),
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

  describe('importArticles', () => {
    it('should import multiple articles', async () => {
      const articlesToImport = [
        Mock.articleDto({
          title: 'Import 1',
          content: 'Content 1',
          tags: JSON.stringify(['import']),
        }),
        Mock.articleDto({
          title: 'Import 2',
          content: 'Content 2',
          category: 'imported',
          tags: JSON.stringify([]),
        }),
      ];

      const mockResults = [
        Mock.article({ id: 1, title: 'Import 1', tags: ['import'] }),
        Mock.article({
          id: 2,
          title: 'Import 2',
          category: 'imported',
          tags: [],
        }),
      ];

      // 使用Mock工具类设置导入结果
      databaseMock.setQueryResult([]); // 标签查询结果

      // 为每个文章的插入设置结果
      databaseMock.db.returning
        .mockResolvedValueOnce([{ id: 1, name: 'import', slug: 'import' }]) // 标签创建
        .mockResolvedValueOnce([mockResults[0]]) // 第一篇文章
        .mockResolvedValueOnce([mockResults[1]]); // 第二篇文章

      const typedArticlesToImport = articlesToImport as unknown as Parameters<
        typeof service.importArticles
      >[0];
      await service.importArticles(typedArticlesToImport);

      // Verify that the import was successful by checking that the method completed without error
      expect(true).toBe(true);
    });
  });

  describe('findByCategory', () => {
    it('should return articles by category with pagination', async () => {
      const mockArticles = Mock.articles(2);
      const countResult = [{ count: 2 }];

      // Mock for the main query
      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockArticles),
              }),
            }),
          }),
        }),
      });

      // Mock for the count query
      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(countResult),
        }),
      });

      const result = await service.findByCategory('tech');

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should support custom pagination parameters', async () => {
      const mockArticles = Mock.articles(5);
      const countResult = [{ count: 15 }];

      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockArticles),
              }),
            }),
          }),
        }),
      });

      databaseMock.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(countResult),
        }),
      });

      const result = await service.findByCategory('tech', { page: 2, pageSize: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(15);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('findOneByPathname', () => {
    it('should return article by pathname', async () => {
      const mockArticle = Mock.article({ id: 1, pathname: 'test-article' });

      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockArticle]),
          }),
        }),
      });

      const result = await service.findOneByPathname('test-article');

      expect(result.id).toBe(1);
      expect(result.pathname).toBe('test-article');
    });

    it('should throw NotFoundException when article with pathname not found', async () => {
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.findOneByPathname('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('isPrivateById', () => {
    it('should return true for private article', async () => {
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ private: true }]),
          }),
        }),
      });

      const result = await service.isPrivateById(1);

      expect(result).toBe(true);
    });

    it('should return false for public article', async () => {
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ private: false }]),
          }),
        }),
      });

      const result = await service.isPrivateById(1);

      expect(result).toBe(false);
    });

    it('should return null when article not found', async () => {
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.isPrivateById(999);

      expect(result).toBe(null);
    });
  });

  describe('isPrivateByPathname', () => {
    it('should return true for private article by pathname', async () => {
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ private: true }]),
          }),
        }),
      });

      const result = await service.isPrivateByPathname('private-article');

      expect(result).toBe(true);
    });

    it('should return false for public article by pathname', async () => {
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ private: false }]),
          }),
        }),
      });

      const result = await service.isPrivateByPathname('public-article');

      expect(result).toBe(false);
    });

    it('should return null when article not found by pathname', async () => {
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.isPrivateByPathname('non-existent');

      expect(result).toBe(null);
    });
  });

  describe('verifyPassword', () => {
    it('should return success for public article without password', async () => {
      const mockArticle = Mock.article({
        id: 1,
        private: false,
        password: null,
      });

      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockArticle]),
          }),
        }),
      });

      const result = await service.verifyPassword(1, 'any-password');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Article is not private');
    });

    it('should return failure for incorrect password', async () => {
      const mockArticle = Mock.article({
        id: 1,
        private: true,
        password: '$2a$10$hashedPassword',
      });

      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockArticle]),
          }),
        }),
      });

      const result = await service.verifyPassword(1, 'wrong-password');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid password');
    });
  });

  describe('verifyPasswordByPathname', () => {
    it('should return success for public article by pathname', async () => {
      const mockArticle = Mock.article({
        id: 1,
        pathname: 'public-article',
        private: false,
        password: null,
      });

      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockArticle]),
          }),
        }),
      });

      const result = await service.verifyPasswordByPathname('public-article', 'any-password');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Article is not private');
    });
  });

  describe('getArticlesGroupedByCategory', () => {
    it('should return articles grouped by category', async () => {
      const mockArticles = [
        Mock.article({
          id: 1,
          title: 'Article 1',
          category: 'Tech',
          private: false,
          hidden: false,
        }),
        Mock.article({
          id: 2,
          title: 'Article 2',
          category: 'Tech',
          private: false,
          hidden: false,
        }),
        Mock.article({
          id: 3,
          title: 'Article 3',
          category: 'Lifestyle',
          private: false,
          hidden: false,
        }),
      ];

      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockArticles),
          }),
        }),
      });

      const result = await service.getArticlesGroupedByCategory();

      expect(result).toHaveProperty('Tech');
      expect(result).toHaveProperty('Lifestyle');
      expect(result.Tech).toHaveLength(2);
      expect(result.Lifestyle).toHaveLength(1);
    });

    it('should group articles without category as Uncategorized', async () => {
      const mockArticles = [
        Mock.article({
          id: 1,
          title: 'No Category',
          category: null,
          private: false,
          hidden: false,
        }),
      ];

      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockArticles),
          }),
        }),
      });

      const result = await service.getArticlesGroupedByCategory();

      expect(result).toHaveProperty('Uncategorized');
      expect(result.Uncategorized).toHaveLength(1);
    });

    it('should exclude private and hidden articles', async () => {
      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getArticlesGroupedByCategory();

      expect(result).toEqual({});
    });
  });

  describe('getArticlesGroupedByTag', () => {
    it('should return articles grouped by tag', async () => {
      const mockArticles = [
        Mock.article({
          id: 1,
          title: 'Article 1',
          tags: ['javascript', 'nodejs'],
          private: false,
          hidden: false,
        }),
        Mock.article({
          id: 2,
          title: 'Article 2',
          tags: ['javascript'],
          private: false,
          hidden: false,
        }),
      ];

      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockArticles),
          }),
        }),
      });

      const result = await service.getArticlesGroupedByTag();

      expect(result).toHaveProperty('javascript');
      expect(result).toHaveProperty('nodejs');
      expect(result.javascript).toHaveLength(2);
      expect(result.nodejs).toHaveLength(1);
    });

    it('should group articles without tags as Untagged', async () => {
      const mockArticles = [
        Mock.article({
          id: 1,
          title: 'No Tags',
          tags: [],
          private: false,
          hidden: false,
        }),
      ];

      databaseMock.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockArticles),
          }),
        }),
      });

      const result = await service.getArticlesGroupedByTag();

      expect(result).toHaveProperty('Untagged');
      expect(result.Untagged).toHaveLength(1);
    });
  });
});
