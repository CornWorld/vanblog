import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArticleService } from './article.service';
import { PipelineService } from '../pipeline/services/pipeline.service';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { ArticleSearchDto } from './dto/article.dto';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('ArticleService', () => {
  let service: ArticleService;
  let mockPipelineService: Partial<PipelineService>;
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn(),
      offset: vi.fn(),
      insert: vi.fn(),
      values: vi.fn(),
      returning: vi.fn(),
      update: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    // Reset all mocks to return this by default
    Object.keys(mockDb).forEach((key) => {
      mockDb[key].mockReturnValue(mockDb);
    });

    mockPipelineService = {
      dispatchEvent: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        ArticleService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: PipelineService,
          useValue: mockPipelineService,
        },
      ],
    }).compile();

    service = module.get<ArticleService>(ArticleService);
  });

  describe('findAll', () => {
    it('should return articles with pagination', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Test Article',
          content: 'Test content',
          tags: JSON.stringify(['test']),
          author: 'admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 10,
          pathname: null,
          category: null,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Setup for Promise.all - both queries run simultaneously
      // Override the last method in each chain to resolve with data
      mockDb.offset.mockResolvedValueOnce(mockArticles);
      // Second where call (for count query) resolves with count
      let whereCallCount = 0;
      mockDb.where.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 2) {
          // This is the count query
          return Promise.resolve([{ count: 1 }]);
        }

        return mockDb;
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
      const mockArticles = [
        {
          id: 1,
          title: 'Test Article',
          content: 'Test content with search term',
          tags: JSON.stringify(['test']),
          author: 'admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 10,
          pathname: null,
          category: null,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Setup for Promise.all - both queries run simultaneously
      // Override the last method in each chain to resolve with data
      mockDb.offset.mockResolvedValueOnce(mockArticles);
      // Second where call (for count query) resolves with count
      let whereCallCount = 0;
      mockDb.where.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 2) {
          // This is the count query
          return Promise.resolve([{ count: 1 }]);
        }

        return mockDb;
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
      // Setup for Promise.all - both queries run simultaneously
      // Override the last method in each chain to resolve with data
      mockDb.offset.mockResolvedValueOnce([]);
      // Second where call (for count query) resolves with count
      let whereCallCount = 0;
      mockDb.where.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 2) {
          // This is the count query
          return Promise.resolve([{ count: 0 }]);
        }

        return mockDb;
      });

      const searchDto: ArticleSearchDto = {
        keyword: 'test',
        page: 1,
        pageSize: 10,
        query: 'test',
        titleOnly: true,
      };

      await service.search(searchDto);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should filter by category and tags', async () => {
      // Setup for Promise.all - both queries run simultaneously
      // Override the last method in each chain to resolve with data
      mockDb.offset.mockResolvedValueOnce([]);
      // Second where call (for count query) resolves with count
      let whereCallCount = 0;
      mockDb.where.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 2) {
          // This is the count query
          return Promise.resolve([{ count: 0 }]);
        }

        return mockDb;
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

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single article', async () => {
      const mockArticle = {
        id: 1,
        title: 'Test Article',
        content: 'Test content',
        tags: JSON.stringify(['test']),
        author: 'admin',
        top: 0,
        hidden: false,
        private: false,
        viewer: 10,
        pathname: null,
        category: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the chain: select().from().where().limit(1)
      mockDb.where.mockReturnValueOnce({
        limit: vi.fn().mockResolvedValueOnce([mockArticle]),
      });

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Article');
    });

    it('should throw NotFoundException when article not found', async () => {
      // Mock the chain: select().from().where().limit(1) returning empty array
      mockDb.where.mockReturnValueOnce({
        limit: vi.fn().mockResolvedValueOnce([]),
      });

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new article', async () => {
      const mockCreatedArticle = {
        id: 1,
        title: 'New Article',
        content: 'New content',
        tags: JSON.stringify(['new']),
        author: 'admin',
        top: 0,
        hidden: false,
        private: false,
        viewer: 0,
        pathname: null,
        category: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedArticle]);

      const createDto = {
        title: 'New Article',
        content: 'New content',
        author: 'test-author',
        tags: JSON.stringify(['new']),
        categories: [],
        isPublished: false,
        isTop: false,
        allowComment: true,
      };

      // Mock the createMissingTags call: db.select().from(tags).where()
      mockDb.from.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([]),
      });

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.title).toBe('New Article');
      expect(result.tags).toEqual(['new']);
    });
  });

  describe('update', () => {
    it('should update an existing article', async () => {
      const mockExistingArticle = {
        id: 1,
        title: 'Existing Article',
        content: 'Existing content',
        tags: JSON.stringify(['existing']),
        author: 'admin',
        top: 0,
        hidden: false,
        private: false,
        viewer: 10,
        pathname: null,
        category: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdatedArticle = {
        id: 1,
        title: 'Updated Article',
        content: 'Updated content',
        tags: JSON.stringify(['updated']),
        author: 'admin',
        top: 0,
        hidden: false,
        private: false,
        viewer: 10,
        pathname: null,
        category: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findOne to return existing article
      mockDb.where.mockReturnValueOnce({
        limit: vi.fn().mockResolvedValueOnce([mockExistingArticle]),
      });

      // Mock the createMissingTags call (db.select().from(tags).where())
      mockDb.where.mockResolvedValueOnce([]);

      // Mock the update call chain
      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValueOnce([mockUpdatedArticle]),
      };
      mockDb.update.mockReturnValueOnce(mockUpdateChain);

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
      // Mock findOne to return empty array (article not found)
      mockDb.where.mockReturnValueOnce({
        limit: vi.fn().mockResolvedValueOnce([]),
      });

      await expect(
        service.update(999, { title: 'Test', content: 'Test content', tags: JSON.stringify([]) }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an article', async () => {
      const mockArticle = {
        id: 1,
        title: 'Test Article',
        content: 'Test content',
        tags: JSON.stringify(['test']),
        author: 'admin',
        top: 0,
        hidden: false,
        private: false,
        viewer: 10,
        pathname: null,
        category: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findOne to return an article
      mockDb.where.mockReturnValueOnce({
        limit: vi.fn().mockResolvedValueOnce([mockArticle]),
      });

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when article not found', async () => {
      // Mock findOne to return empty array (article not found)
      mockDb.where.mockReturnValueOnce({
        limit: vi.fn().mockResolvedValueOnce([]),
      });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportArticles', () => {
    it('should export all articles', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Article 1',
          content: 'Content 1',
          tags: JSON.stringify(['tag1']),
          author: 'admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 100,
          pathname: null,
          category: null,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          title: 'Article 2',
          content: 'Content 2',
          tags: null,
          author: 'admin',
          top: 1,
          hidden: true,
          private: false,
          viewer: 50,
          pathname: 'article-2',
          category: 'tech',
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.from.mockResolvedValueOnce(mockArticles);

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
        {
          title: 'Import 1',
          content: 'Content 1',
          author: 'test-author',
          tags: JSON.stringify(['import']),
          categories: [],
          isPublished: false,
          isTop: false,
          allowComment: true,
        },
        {
          title: 'Import 2',
          content: 'Content 2',
          author: 'test-author',
          category: 'imported',
          tags: JSON.stringify([]),
          categories: [],
          isPublished: false,
          isTop: false,
          allowComment: true,
        },
      ];

      const mockResults = articlesToImport.map((article, index) => ({
        id: index + 1,
        ...article,
        tags: JSON.stringify(article.tags),
        category: article.category ?? null,
        author: 'admin',
        top: 0,
        hidden: false,
        private: false,
        viewer: 0,
        pathname: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Mock the db.select().from(tags).where() calls for both articles
      // Reset where to return mockDb for chaining, then override specific calls
      mockDb.where.mockReturnValue(mockDb);
      // Override the final result for the tag queries
      mockDb.where
        .mockResolvedValueOnce([]) // First article tags check
        .mockResolvedValueOnce([]); // Second article tags check (no tags)

      // Need to mock values for tags insert before returning
      mockDb.values
        .mockReturnValueOnce(mockDb) // First call for tags insert
        .mockReturnValueOnce(mockDb) // Second call for first article
        .mockReturnValueOnce(mockDb); // Third call for second article

      mockDb.returning
        .mockResolvedValueOnce([{ id: 1, name: 'import', slug: 'import' }]) // Tag creation returning
        .mockResolvedValueOnce([mockResults[0]]) // First article
        .mockResolvedValueOnce([mockResults[1]]); // Second article

      await service.importArticles(articlesToImport);

      expect(mockDb.insert).toHaveBeenCalledTimes(2); // 1 for tags, 1 for articles (second article has no tags)
      expect(mockDb.values).toHaveBeenCalledTimes(2); // 1 for tags, 1 for articles
    });
  });
});
