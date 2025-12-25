import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: CategoryService;
  let mockCategoryService: Partial<CategoryService>;

  beforeEach(async () => {
    mockCategoryService = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      findByName: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getArticlesByCategoryId: vi.fn(),
      verifyPassword: vi.fn(),
      getStatistics: vi.fn(),
      getCategoriesWithTags: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
      ],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    service = module.get<CategoryService>(CategoryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCategories', () => {
    it('should return all categories', async () => {
      const mockCategories = {
        items: [
          {
            id: 1,
            name: 'Technology',
            slug: 'tech',
            description: 'Tech articles',
            private: false,
            password: null,
            articleCount: 5,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
      };

      vi.mocked(service.findAll).mockResolvedValue(mockCategories);

      const handler = controller.getCategories();
      const result = await handler();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual({
        status: 200,
        body: mockCategories.items,
      });
    });

    it('should handle undefined description fields', async () => {
      const mockCategories = {
        items: [
          {
            id: 1,
            name: 'Technology',
            slug: 'tech',
            description: null,
            private: false,
            password: null,
            articleCount: 5,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
      };

      vi.mocked(service.findAll).mockResolvedValue(mockCategories);

      const handler = controller.getCategories();
      const result = await handler();

      expect(result.body[0].description).toBeUndefined();
    });

    it('should return empty array when no categories exist', async () => {
      const mockCategories = {
        items: [],
        total: 0,
      };

      vi.mocked(service.findAll).mockResolvedValue(mockCategories);

      const handler = controller.getCategories();
      const result = await handler();

      expect(result.status).toBe(200);
      expect(result.body).toEqual([]);
      expect(result.body).toHaveLength(0);
    });

    it('should handle multiple categories with mixed description values', async () => {
      const mockCategories = {
        items: [
          {
            id: 1,
            name: 'Tech',
            slug: 'tech',
            description: 'Tech articles',
            private: false,
            password: null,
            articleCount: 5,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            name: 'Lifestyle',
            slug: 'lifestyle',
            description: null,
            private: false,
            password: null,
            articleCount: 3,
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        ],
        total: 2,
      };

      vi.mocked(service.findAll).mockResolvedValue(mockCategories);

      const handler = controller.getCategories();
      const result = await handler();

      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(2);
      expect(result.body[0].description).toBe('Tech articles');
      expect(result.body[1].description).toBeUndefined();
    });
  });

  describe('createCategory', () => {
    it('should create a new category', async () => {
      const createDto = {
        name: 'New Category',
        slug: 'new-category',
        description: 'A new category',
      };

      const mockCreatedCategory = {
        id: 1,
        name: 'New Category',
        slug: 'new-category',
        description: 'A new category',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(service.create).mockResolvedValue(mockCreatedCategory);

      const handler = controller.createCategory();
      const result = await handler({ body: createDto });

      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        name: createDto.name,
      });
      expect(result).toEqual({
        status: 201,
        body: {
          ...mockCreatedCategory,
          description: 'A new category',
        },
      });
    });

    it('should create category with null description', async () => {
      const createDto = {
        name: 'New Category',
        slug: 'new-category',
      };

      const mockCreatedCategory = {
        id: 1,
        name: 'New Category',
        slug: 'new-category',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(service.create).mockResolvedValue(mockCreatedCategory);

      const handler = controller.createCategory();
      const result = await handler({ body: createDto });

      expect(result.body.description).toBeUndefined();
    });

    it('should create category with empty string description', async () => {
      const createDto = {
        name: 'New Category',
        slug: 'new-category',
        description: '',
      };

      const mockCreatedCategory = {
        id: 1,
        name: 'New Category',
        slug: 'new-category',
        description: '',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(service.create).mockResolvedValue(mockCreatedCategory);

      const handler = controller.createCategory();
      const result = await handler({ body: createDto });

      expect(result.status).toBe(201);
      expect(result.body.description).toBe('');
    });

    it('should distinguish between null and undefined description', async () => {
      const createDtoNull = {
        name: 'Category A',
        slug: 'cat-a',
        description: null,
      };

      const createDtoUndefined = {
        name: 'Category B',
        slug: 'cat-b',
        description: undefined,
      };

      const mockCategoryNull = {
        id: 1,
        name: 'Category A',
        slug: 'cat-a',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockCategoryUndefined = {
        id: 2,
        name: 'Category B',
        slug: 'cat-b',
        description: undefined,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(service.create).mockResolvedValueOnce(mockCategoryNull);
      const handler = controller.createCategory();
      const resultNull = await handler({ body: createDtoNull });
      expect(resultNull.body.description).toBeUndefined();

      vi.mocked(service.create).mockResolvedValueOnce(mockCategoryUndefined);
      const resultUndefined = await handler({ body: createDtoUndefined });
      expect(resultUndefined.body.description).toBeUndefined();
    });

    it('should handle whitespace-only description as non-empty', async () => {
      const createDto = {
        name: 'New Category',
        slug: 'new-category',
        description: '   ',
      };

      const mockCreatedCategory = {
        id: 1,
        name: 'New Category',
        slug: 'new-category',
        description: '   ',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(service.create).mockResolvedValue(mockCreatedCategory);

      const handler = controller.createCategory();
      const result = await handler({ body: createDto });

      expect(result.status).toBe(201);
      expect(result.body.description).toBe('   ');
      expect(result.body.description).not.toBe('');
      expect(result.body.description).not.toBeUndefined();
    });

    it('should create category with special characters in name', async () => {
      const createDto = {
        name: 'Tech & Design',
        slug: 'tech-design',
        description: 'Technology and Design articles',
      };

      const mockCreatedCategory = {
        id: 1,
        name: 'Tech & Design',
        slug: 'tech-design',
        description: 'Technology and Design articles',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(service.create).mockResolvedValue(mockCreatedCategory);

      const handler = controller.createCategory();
      const result = await handler({ body: createDto });

      expect(result.status).toBe(201);
      expect(result.body.name).toBe('Tech & Design');
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('updateCategory', () => {
    it('should update an existing category', async () => {
      const updateDto = {
        name: 'Updated Category',
        description: 'Updated description',
      };

      const mockCategory = {
        id: 1,
        name: 'Old Category',
        slug: 'old-category',
        description: 'Old description',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockUpdatedCategory = {
        ...mockCategory,
        name: 'Updated Category',
        description: 'Updated description',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      vi.mocked(service.findByName).mockResolvedValue({
        id: 1,
        name: 'Old Category',
        slug: 'old-category',
        description: 'Old description',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      } as any);
      vi.mocked(service.update).mockResolvedValue(mockUpdatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: 'old-category' }, body: updateDto });

      expect(service.findByName).toHaveBeenCalledWith('old-category');
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
      expect(result).toEqual({
        status: 200,
        body: mockUpdatedCategory,
      });
    });

    it('should throw NotFoundException when category not found', async () => {
      const updateDto = {
        name: 'Updated Category',
      };

      vi.mocked(service.findByName).mockResolvedValue(null);

      const handler = controller.updateCategory();

      await expect(handler({ params: { name: 'non-existent' }, body: updateDto })).rejects.toThrow(
        NotFoundException,
      );
      await expect(handler({ params: { name: 'non-existent' }, body: updateDto })).rejects.toThrow(
        'Category non-existent not found',
      );
    });

    it('should update only name field', async () => {
      const updateDto = {
        name: 'New Name Only',
      };

      const mockCategory = {
        id: 1,
        name: 'Old Name',
        slug: 'old-name',
        description: 'Keep this description',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockUpdatedCategory = {
        ...mockCategory,
        name: 'New Name Only',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.update).mockResolvedValue(mockUpdatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: 'old-name' }, body: updateDto });

      expect(result.status).toBe(200);
      expect(result.body.name).toBe('New Name Only');
      expect(result.body.description).toBe('Keep this description');
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('should update description to null', async () => {
      const updateDto = {
        description: null,
      };

      const mockCategory = {
        id: 1,
        name: 'Category',
        slug: 'category',
        description: 'Old description',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockUpdatedCategory = {
        ...mockCategory,
        description: null,
        updatedAt: '2024-01-02T00:00:00Z',
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.update).mockResolvedValue(mockUpdatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: 'category' }, body: updateDto });

      expect(result.status).toBe(200);
      expect(result.body.description).toBeUndefined();
    });

    it('should handle category name with special characters', async () => {
      const updateDto = {
        description: 'Updated description',
      };

      const mockCategory = {
        id: 1,
        name: 'C++ Programming',
        slug: 'cpp-programming',
        description: 'Old description',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockUpdatedCategory = {
        ...mockCategory,
        description: 'Updated description',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.update).mockResolvedValue(mockUpdatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: 'cpp-programming' }, body: updateDto });

      expect(result.status).toBe(200);
      expect(service.findByName).toHaveBeenCalledWith('cpp-programming');
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category', async () => {
      const mockCategory = {
        id: 1,
        name: 'Category to Delete',
        slug: 'category-to-delete',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.remove).mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      const result = await handler({ params: { name: 'category-to-delete' } });

      expect(service.findByName).toHaveBeenCalledWith('category-to-delete');
      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        status: 200,
        body: { success: true },
      });
    });

    it('should throw NotFoundException when category not found', async () => {
      vi.mocked(service.findByName).mockResolvedValue(null);

      const handler = controller.deleteCategory();

      await expect(handler({ params: { name: 'non-existent' } })).rejects.toThrow(
        NotFoundException,
      );
      await expect(handler({ params: { name: 'non-existent' } })).rejects.toThrow(
        'Category non-existent not found',
      );
    });

    it('should delete category with special characters in name', async () => {
      const mockCategory = {
        id: 1,
        name: 'C++ & Java',
        slug: 'cpp-java',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.remove).mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      const result = await handler({ params: { name: 'cpp-java' } });

      expect(service.findByName).toHaveBeenCalledWith('cpp-java');
      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result.body.success).toBe(true);
    });

    it('should handle successful deletion and verify remove was called once', async () => {
      const mockCategory = {
        id: 5,
        name: 'Test Category',
        slug: 'test-category',
        description: 'Test description',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.remove).mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      await handler({ params: { name: 'test-category' } });

      expect(service.remove).toHaveBeenCalledTimes(1);
      expect(service.remove).toHaveBeenCalledWith(5);
    });
  });

  describe('getArticlesByCategory', () => {
    it('should return articles in a category', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: 'Tech articles',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = {
        items: [
          {
            id: 1,
            title: 'Article 1',
            content: 'Content 1',
            pathname: '/article-1',
            tags: ['tag1', 'tag2'],
            category: 'Technology',
            author: 'admin',
            top: 0,
            hidden: false,
            private: false,
            password: null,
            viewer: 100,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 1000,
        totalPages: 1,
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.getArticlesByCategoryId).mockResolvedValue(mockArticles);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'Technology' } });

      expect(service.findByName).toHaveBeenCalledWith('Technology');
      expect(service.getArticlesByCategoryId).toHaveBeenCalledWith(1, {
        page: 1,
        pageSize: 1000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(1);
    });

    it('should return empty array when category has no articles', async () => {
      const mockCategory = {
        id: 1,
        name: 'Empty Category',
        slug: 'empty',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 1000,
        totalPages: 0,
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.getArticlesByCategoryId).mockResolvedValue(mockArticles);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'Empty Category' } });

      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(0);
      expect(result.body).toEqual([]);
    });

    it('should handle articles with top and viewer values', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: 'Tech articles',
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = {
        items: [
          {
            id: 1,
            title: 'Article 1',
            content: 'Content 1',
            pathname: '/article-1',
            tags: null,
            category: 'Technology',
            author: 'admin',
            top: 5,
            hidden: false,
            private: false,
            password: 'encrypted-password',
            viewer: null,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 1000,
        totalPages: 1,
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.getArticlesByCategoryId).mockResolvedValue(mockArticles);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'Technology' } });

      expect(result.body[0].views).toBe(0);
      expect(result.body[0].isTop).toBe(true);
      expect(result.body[0].password).toBe('encrypted-password');
    });

    it('should throw NotFoundException when category not found', async () => {
      vi.mocked(service.findByName).mockResolvedValue(null);

      const handler = controller.getArticlesByCategory();

      await expect(handler({ params: { name: 'non-existent' } })).rejects.toThrow(
        NotFoundException,
      );
      await expect(handler({ params: { name: 'non-existent' } })).rejects.toThrow(
        'Category non-existent not found',
      );
    });

    it('should map article fields correctly', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = {
        items: [
          {
            id: 1,
            title: 'Article 1',
            content: 'Content 1',
            pathname: '/article-1',
            tags: ['tag1'],
            category: null,
            author: 'admin',
            top: null,
            hidden: false,
            private: true,
            password: null,
            viewer: 50,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 1000,
        totalPages: 1,
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.getArticlesByCategoryId).mockResolvedValue(mockArticles);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'Technology' } });

      const article = result.body[0];
      expect(article.id).toBe(1);
      expect(article.title).toBe('Article 1');
      expect(article.content).toBe('Content 1');
      expect(article.summary).toBeUndefined();
      expect(article.cover).toBeUndefined();
      expect(article.category).toBeUndefined();
      expect(article.tags).toBeUndefined();
      expect(article.views).toBe(50);
      expect(article.likes).toBe(0);
      expect(article.isTop).toBe(false);
      expect(article.isHot).toBe(false);
      expect(article.pubTime).toBe('2024-01-02T00:00:00Z');
      expect(article.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(article.updatedAt).toBe('2024-01-02T00:00:00Z');
      expect(article.private).toBe(true);
      expect(article.password).toBeUndefined();
      expect(article.toc).toBeUndefined();
    });

    it('should handle multiple articles in category', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = {
        items: [
          {
            id: 1,
            title: 'Article 1',
            content: 'Content 1',
            pathname: '/article-1',
            tags: ['tag1'],
            category: 'Technology',
            author: 'admin',
            top: 5,
            hidden: false,
            private: false,
            password: null,
            viewer: 100,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            title: 'Article 2',
            content: 'Content 2',
            pathname: '/article-2',
            tags: ['tag2'],
            category: 'Technology',
            author: 'admin',
            top: 0,
            hidden: false,
            private: false,
            password: null,
            viewer: 50,
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        ],
        total: 2,
        page: 1,
        pageSize: 1000,
        totalPages: 1,
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.getArticlesByCategoryId).mockResolvedValue(mockArticles);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'Technology' } });

      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(2);
      expect(result.body[0].id).toBe(1);
      expect(result.body[0].isTop).toBe(true);
      expect(result.body[0].views).toBe(100);
      expect(result.body[1].id).toBe(2);
      expect(result.body[1].isTop).toBe(false);
      expect(result.body[1].views).toBe(50);
    });

    it('should handle articles with null category field', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = {
        items: [
          {
            id: 1,
            title: 'Article without category',
            content: 'Content',
            pathname: '/article',
            tags: null,
            category: null,
            author: 'admin',
            top: 0,
            hidden: false,
            private: false,
            password: null,
            viewer: 10,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 1000,
        totalPages: 1,
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.getArticlesByCategoryId).mockResolvedValue(mockArticles);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'Technology' } });

      expect(result.body[0].category).toBeUndefined();
      expect(result.body[0].tags).toBeUndefined();
    });

    it('should correctly map zero viewer count', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockArticles = {
        items: [
          {
            id: 1,
            title: 'New Article',
            content: 'Content',
            pathname: '/new',
            tags: null,
            category: 'Technology',
            author: 'admin',
            top: 0,
            hidden: false,
            private: false,
            password: null,
            viewer: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 1000,
        totalPages: 1,
      };

      vi.mocked(service.findByName).mockResolvedValue(mockCategory as any);
      vi.mocked(service.getArticlesByCategoryId).mockResolvedValue(mockArticles);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'Technology' } });

      expect(result.body[0].views).toBe(0);
      expect(result.body[0].isTop).toBe(false);
    });
  });
});
