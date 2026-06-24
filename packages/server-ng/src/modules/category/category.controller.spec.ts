import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect } from 'vitest';

import { Mock, createPaginatedResult } from '@test/mock';
import { createMockCategory } from '@test/fixtures/test-data';

import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

describe('CategoryController', () => {
  let controller: CategoryController;
  let categoryService: ReturnType<typeof Mock.categoryService>;

  beforeEach(async () => {
    categoryService = Mock.categoryService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: categoryService,
        },
      ],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllCategories', () => {
    it('should return all categories with count', async () => {
      const mockCategories = Mock.categories(3, { articleCount: 5 });
      const paginatedResult = createPaginatedResult(mockCategories, mockCategories.length);

      categoryService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.getAllCategories();

      expect(categoryService.findAll).toHaveBeenCalledTimes(1);
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should return empty result when no categories exist', async () => {
      const paginatedResult = createPaginatedResult([], 0);

      categoryService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.getAllCategories();

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('create', () => {
    it('should create a new category successfully', async () => {
      const createDto = {
        name: 'New Category',
        slug: 'new-category',
        description: 'A new category',
      };

      const createdCategory = Mock.category({
        id: 1,
        name: createDto.name,
        slug: createDto.slug,
        description: createDto.description,
      });

      categoryService.create.mockResolvedValue(createdCategory);

      const result = await controller.create(createDto);

      expect(categoryService.create).toHaveBeenCalledWith(createDto);
      expect(result.name).toBe(createDto.name);
      expect(result.description).toBe(createDto.description);
    });

    it('should create category with null description converted to undefined', async () => {
      const createDto = {
        name: 'New Category',
        slug: 'new-category',
      };

      const createdCategory = Mock.category({
        name: createDto.name,
        slug: createDto.slug,
        description: null,
      });

      categoryService.create.mockResolvedValue(createdCategory);

      const result = await controller.create(createDto);

      expect(result.description).toBeUndefined();
    });

    it('should create category with empty string description', async () => {
      const createDto = {
        name: 'New Category',
        slug: 'new-category',
        description: '',
      };

      const createdCategory = Mock.category({
        name: createDto.name,
        slug: createDto.slug,
        description: '',
      });

      categoryService.create.mockResolvedValue(createdCategory);

      const result = await controller.create(createDto);

      expect(result.description).toBe('');
    });

    it('should handle category creation with special characters in name', async () => {
      const createDto = {
        name: 'Tech & Design',
        slug: 'tech-design',
        description: 'Technology and Design articles',
      };

      const createdCategory = Mock.category({
        name: createDto.name,
        slug: createDto.slug,
        description: createDto.description,
      });

      categoryService.create.mockResolvedValue(createdCategory);

      const result = await controller.create(createDto);

      expect(result.name).toBe('Tech & Design');
      expect(categoryService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('updateByName', () => {
    it('should update an existing category', async () => {
      const categoryName = 'test-category';
      const updateDto = {
        name: 'Updated Category',
        description: 'Updated description',
      };

      const updatedCategory = createMockCategory({
        id: 1,
        name: updateDto.name,
        description: updateDto.description,
      });

      categoryService.updateByName.mockResolvedValue(updatedCategory);

      const result = await controller.updateByName(categoryName, updateDto);

      expect(categoryService.updateByName).toHaveBeenCalledWith(categoryName, updateDto);
      expect(result.name).toBe(updateDto.name);
      expect(result.description).toBe(updateDto.description);
    });

    it('should update only name field', async () => {
      const categoryName = 'test-category';
      const updateDto = {
        name: 'New Name Only',
      };

      const existingCategory = createMockCategory({
        id: 1,
        name: 'Old Name',
        slug: 'old-name',
        description: 'Keep this description',
      });

      const updatedCategory = createMockCategory({
        ...existingCategory,
        name: updateDto.name,
      });

      categoryService.updateByName.mockResolvedValue(updatedCategory);

      const result = await controller.updateByName(categoryName, updateDto);

      expect(result.name).toBe('New Name Only');
      expect(result.description).toBe('Keep this description');
      expect(categoryService.updateByName).toHaveBeenCalledWith(categoryName, updateDto);
    });

    it('should update description to null (converted to undefined)', async () => {
      const categoryName = 'test-category';
      const updateDto = {
        description: null,
      };

      const updatedCategory = Mock.category({
        id: 1,
        name: 'Category',
        description: null,
      });

      categoryService.updateByName.mockResolvedValue(updatedCategory);

      const result = await controller.updateByName(categoryName, updateDto);

      // controller converts null to undefined using ?? operator
      expect(result.description).toBeUndefined();
    });
  });

  describe('deleteByName', () => {
    it('should delete a category successfully', async () => {
      const categoryName = 'test-category';

      categoryService.removeByName.mockResolvedValue(undefined);

      const result = await controller.deleteByName(categoryName);

      expect(categoryService.removeByName).toHaveBeenCalledWith(categoryName);
      expect(result.success).toBe(true);
    });

    it('should verify remove is called exactly once', async () => {
      const categoryName = 'test-category';

      categoryService.removeByName.mockResolvedValue(undefined);

      await controller.deleteByName(categoryName);

      expect(categoryService.removeByName).toHaveBeenCalledTimes(1);
      expect(categoryService.removeByName).toHaveBeenCalledWith(categoryName);
    });
  });

  describe('getArticlesByCategory', () => {
    it('should return articles in a category', async () => {
      const categoryId = 1;

      const mockArticles = Mock.articles(2, {
        category: 'Technology',
        tags: ['tag1', 'tag2'],
      });

      const paginatedResult = createPaginatedResult(mockArticles, 2, 1, 1000);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const result = await controller.getArticlesByCategoryId(categoryId, {});

      expect(categoryService.getArticlesByCategoryId).toHaveBeenCalledWith(1, {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        includeHidden: false,
      });
      expect(result.items).toHaveLength(2);
    });

    it('should return empty array when category has no articles', async () => {
      const categoryId = 1;

      const paginatedResult = createPaginatedResult([], 0, 1, 1000);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const result = await controller.getArticlesByCategoryId(categoryId, {});

      expect(result.items).toHaveLength(0);
      expect(result.items).toEqual([]);
    });

    it('should handle multiple articles with different field values', async () => {
      const categoryId = 1;

      const mockArticles = [
        Mock.article({ id: 1, top: 5, viewer: 100, category: 'Tech' }),
        Mock.article({ id: 2, top: 0, viewer: 50, category: undefined as unknown as string }),
      ];

      const paginatedResult = createPaginatedResult(mockArticles, 2);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const result = await controller.getArticlesByCategoryId(categoryId, {});

      expect(result.items).toHaveLength(2);

      expect(result.items[0].id).toBe(1);
      expect(result.items[0].top).toBe(5);
      expect(result.items[0].viewer).toBe(100);

      expect(result.items[1].id).toBe(2);
      expect(result.items[1].top).toBe(0);
      expect(result.items[1].viewer).toBe(50);
    });
  });

  describe('getArticlesByCategoryNameDirect', () => {
    it('should return articles by category name', async () => {
      const categoryName = 'Technology';

      const mockArticles = Mock.articles(2, {
        category: categoryName,
        tags: ['tag1', 'tag2'],
      });

      // Directly use createPaginatedResult instead of createPaginatedResult
      const paginatedResult = createPaginatedResult(mockArticles, 2, 1, 1000);

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const result = await controller.getArticlesByCategoryNameDirect(categoryName, {});

      expect(categoryService.getArticlesByCategoryName).toHaveBeenCalledWith(categoryName, {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        includeHidden: false,
      });
      expect(result.items).toHaveLength(2);
    });

    it('should return empty array when category has no articles', async () => {
      const categoryName = 'Empty';

      const paginatedResult = createPaginatedResult([], 0, 1, 1000);

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const result = await controller.getArticlesByCategoryNameDirect(categoryName, {});

      expect(result.items).toHaveLength(0);
      expect(result.items).toEqual([]);
    });

    it('should correctly map article viewer count to viewer', async () => {
      const categoryName = 'Tech';

      const mockArticles = [
        Mock.article({ viewer: 100 }),
        Mock.article({ viewer: 0 }),
        Mock.article({ viewer: 0 }),
      ];

      const paginatedResult = createPaginatedResult(mockArticles, 3);

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const result = await controller.getArticlesByCategoryNameDirect(categoryName, {});

      expect(result.items[0].viewer).toBe(100);
      expect(result.items[1].viewer).toBe(0);
      expect(result.items[2].viewer).toBe(0);
    });

    it('should correctly map top field to top', async () => {
      const categoryName = 'Tech';

      const mockArticles = [
        Mock.article({ top: 5 }),
        Mock.article({ top: 0 }),
        Mock.article({ top: 0 }),
      ];

      const paginatedResult = createPaginatedResult(mockArticles, 3);

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const result = await controller.getArticlesByCategoryNameDirect(categoryName, {});

      expect(result.items[0].top).toBe(5);
      expect(result.items[1].top).toBe(0);
      expect(result.items[2].top).toBe(0);
    });

    it('should preserve password when present', async () => {
      const categoryName = 'Tech';

      const mockArticles = [
        Mock.article({ password: 'encrypted-password' }),
        Mock.article({ password: null }),
      ];

      const paginatedResult = createPaginatedResult(mockArticles, 2);

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const result = await controller.getArticlesByCategoryNameDirect(categoryName, {});

      expect(result.items[0].password).toBe('encrypted-password');
      expect(result.items[1].password).toBeNull();
    });
  });
});
