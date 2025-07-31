import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArticleService } from './article.service';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { ArticleSearchDto } from './dto/article.dto';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('ArticleService', () => {
  let service: ArticleService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
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

      // First query (articles)
      mockDb.offset.mockResolvedValueOnce(mockArticles);
      // Second query (count) - reset chain after offset
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result.data).toHaveLength(1);
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

      // First query (articles)
      mockDb.offset.mockResolvedValueOnce(mockArticles);
      // Second query (count) - reset chain after offset
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockResolvedValueOnce([{ count: 1 }]);

      const searchDto: ArticleSearchDto = {
        query: 'search term',
        page: 1,
        pageSize: 10,
      };

      const result = await service.search(searchDto);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.query).toBe('search term');
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should search only in title when titleOnly is true', async () => {
      // First query (articles)
      mockDb.offset.mockResolvedValueOnce([]);
      // Second query (count) - reset chain after offset
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockResolvedValueOnce([{ count: 0 }]);

      const searchDto: ArticleSearchDto = {
        query: 'test',
        titleOnly: true,
      };

      await service.search(searchDto);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should filter by category and tags', async () => {
      // First query (articles)
      mockDb.offset.mockResolvedValueOnce([]);
      // Second query (count) - reset chain after offset
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockResolvedValueOnce([{ count: 0 }]);

      const searchDto: ArticleSearchDto = {
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
      };

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

  describe('incrementViewer', () => {
    it('should increment viewer count', async () => {
      mockDb.where.mockResolvedValueOnce(undefined);

      await expect(service.incrementViewer(1)).resolves.not.toThrow();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
