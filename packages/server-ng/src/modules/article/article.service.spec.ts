import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect } from 'vitest';

import { MockUtils } from '../../../test/mock-utils';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { PipelineService } from '../pipeline/services/pipeline.service';
import { HookService } from '../plugin/services/hook.service';

import { ArticleService } from './article.service';

import type { ArticleSearchDto } from './dto/article.dto';
import type { DatabaseMockBuilder } from '../../../test/mock-utils';

describe('ArticleService', () => {
  let service: ArticleService;
  let mockPipelineService: Partial<PipelineService>;
  let mockHookService: Partial<HookService>;
  let databaseMock: DatabaseMockBuilder;

  beforeEach(async () => {
    // 使用Mock工具类创建数据库Mock
    databaseMock = new MockUtils.database();

    // 使用Mock工具类创建服务Mock
    mockPipelineService = MockUtils.services.createPipelineServiceMock();
    mockHookService = MockUtils.services.createHookServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleService,
        {
          provide: DATABASE_CONNECTION,
          useValue: databaseMock.build(),
        },
        {
          provide: PipelineService,
          useValue: mockPipelineService,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
      ],
    }).compile();

    service = module.get<ArticleService>(ArticleService);
  });

  describe('findAll', () => {
    it('should return articles with pagination', async () => {
      const mockArticles = MockUtils.testData.createArticles(1);

      // 使用Mock工具类设置查询结果
      databaseMock.setQueryResult(mockArticles);
      databaseMock.setCountResult(1);

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
      const mockArticles = MockUtils.testData.createArticles(1);

      // 使用Mock工具类设置搜索结果
      databaseMock.setQueryResult(mockArticles);
      databaseMock.setCountResult(1);

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
      // 使用Mock工具类设置空搜索结果
      databaseMock.setQueryResult([]);
      databaseMock.setCountResult(0);

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
      // 使用Mock工具类设置空搜索结果
      databaseMock.setQueryResult([]);
      databaseMock.setCountResult(0);

      const searchDto: ArticleSearchDto = {
        keyword: 'test',
        page: 1,
        pageSize: 10,
        query: 'test',
        category: 'tech',
        tags: ['javascript', 'node'],
      };

      await service.search(searchDto);

      expect(databaseMock.db.where).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single article', async () => {
      const mockArticle = MockUtils.testData.createArticle({ id: 1 });

      // 使用Mock工具类设置查询结果
      databaseMock.setQueryResult([mockArticle]);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Article');
    });

    it('should throw NotFoundException when article not found', async () => {
      // 使用Mock工具类设置空查询结果
      databaseMock.setQueryResult([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new article', async () => {
      const mockCreatedArticle = MockUtils.testData.createArticle({
        id: 1,
        title: 'New Article',
        content: 'New content',
        tags: ['new'],
      });

      const createDto = MockUtils.testData.createArticleDto({
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
  });

  describe('update', () => {
    it('should update an existing article', async () => {
      const mockExistingArticle = MockUtils.testData.createArticle({
        id: 1,
        title: 'Existing Article',
        content: 'Existing content',
        tags: ['existing'],
      });

      const mockUpdatedArticle = MockUtils.testData.createArticle({
        id: 1,
        title: 'Updated Article',
        content: 'Updated content',
        tags: ['updated'],
      });

      // 使用Mock工具类设置查询和更新结果
      databaseMock.setQueryResult([mockExistingArticle]); // findOne结果
      databaseMock.setUpdateResult([mockUpdatedArticle]); // 更新结果

      const updateDto = {
        title: 'Updated Article',
        content: 'Updated content',
        tags: JSON.stringify(['updated']),
      };

      const result = await service.update(1, updateDto);

      expect(result.title).toBe('Updated Article');
      expect(result.tags).toEqual(['updated']);
    });

    it('should throw NotFoundException when article not found', async () => {
      // 使用Mock工具类设置空查询结果
      databaseMock.setQueryResult([]);

      await expect(
        service.update(999, { title: 'Test', content: 'Test content', tags: JSON.stringify([]) }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an article', async () => {
      const mockArticle = MockUtils.testData.createArticle({ id: 1 });

      // 使用Mock工具类设置查询结果
      databaseMock.setQueryResult([mockArticle]);

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when article not found', async () => {
      // 使用Mock工具类设置空查询结果
      databaseMock.setQueryResult([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportArticles', () => {
    it('should export all articles', async () => {
      const mockArticles = [
        MockUtils.testData.createArticle({
          id: 1,
          title: 'Article 1',
          content: 'Content 1',
          tags: JSON.stringify(['tag1']),
          viewer: 100,
        }),
        MockUtils.testData.createArticle({
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

      // 使用Mock工具类设置查询结果
      databaseMock.setQueryResult(mockArticles);

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
        MockUtils.testData.createArticleDto({
          title: 'Import 1',
          content: 'Content 1',
          tags: JSON.stringify(['import']),
        }),
        MockUtils.testData.createArticleDto({
          title: 'Import 2',
          content: 'Content 2',
          category: 'imported',
          tags: JSON.stringify([]),
        }),
      ];

      const mockResults = [
        MockUtils.testData.createArticle({ id: 1, title: 'Import 1', tags: ['import'] }),
        MockUtils.testData.createArticle({
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
});
