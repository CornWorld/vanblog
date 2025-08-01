import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArticleService } from './article.service';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { ArticleSearchDto } from './dto/article.dto';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('ArticleService', () => {
  let service: ArticleService;

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

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        ArticleService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
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

      mockDb.limit.mockResolvedValueOnce([mockArticle]);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Article');
    });

    it('should throw NotFoundException when article not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

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
        tags: ['new'],
        categories: [],
        isPublished: false,
        isTop: false,
        allowComment: true,
      };

      // Mock the db.select().from(tags) call
      mockDb.from.mockResolvedValueOnce([]);

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.title).toBe('New Article');
      expect(result.tags).toEqual(['new']);
    });
  });

  describe('update', () => {
    it('should update an existing article', async () => {
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

      mockDb.returning.mockResolvedValueOnce([mockUpdatedArticle]);

      const updateDto = {
        title: 'Updated Article',
        content: 'Updated content',
        tags: ['updated'],
      };

      // Mock the db.select().from(tags) call
      mockDb.from.mockResolvedValueOnce([]);

      const result = await service.update(1, updateDto);

      expect(result.title).toBe('Updated Article');
      expect(result.tags).toEqual(['updated']);
    });

    it('should throw NotFoundException when article not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.update(999, { title: 'Test', content: 'Test content' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete an article', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when article not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

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
          tags: ['import'],
          categories: [],
          isPublished: false,
          isTop: false,
          allowComment: true,
        },
        {
          title: 'Import 2',
          content: 'Content 2',
          category: 'imported',
          tags: [],
          categories: [],
          isPublished: false,
          isTop: false,
          allowComment: true,
        },
      ];

      const mockResults = articlesToImport.map((article, index) => ({
        id: index + 1,
        ...article,
        tags: article.tags ? JSON.stringify(article.tags) : null,
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

      // Mock the db.select().from(tags) calls for both articles
      mockDb.from
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

      expect(mockDb.insert).toHaveBeenCalledTimes(3); // 1 for tags, 2 for articles
      expect(mockDb.values).toHaveBeenCalledTimes(3); // 1 for tags, 2 for articles
    });
  });
});
