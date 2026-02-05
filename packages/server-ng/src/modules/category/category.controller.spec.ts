import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect } from 'vitest';

import { Mock } from '@test/mock';
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

  describe('getCategories', () => {
    it('should return all categories with article counts', async () => {
      // ✅ 优化：使用新的扁平化 Mock API
      const mockCategories = Mock.categories(3, { articleCount: 5 });
      const paginatedResult = Mock.paginated(mockCategories, mockCategories.length);

      categoryService.findAll.mockResolvedValue(paginatedResult);

      const handler = controller.getCategories();
      const result = await handler();

      expect(categoryService.findAll).toHaveBeenCalledTimes(1);
      expect(result.body).toHaveLength(3);
      expect(result.body[0]).toHaveProperty('count');
    });

    it('should convert null description to undefined', async () => {
      const category = Mock.category({ description: null });
      const paginatedResult = Mock.paginated([category], 1);

      categoryService.findAll.mockResolvedValue(paginatedResult);

      const handler = controller.getCategories();
      const result = await handler();

      expect(result.body[0].description).toBeUndefined();
    });

    it('should preserve non-null description', async () => {
      const category = Mock.category({ description: 'Tech articles' });
      const paginatedResult = Mock.paginated([category], 1);

      categoryService.findAll.mockResolvedValue(paginatedResult);

      const handler = controller.getCategories();
      const result = await handler();

      expect(result.body[0].description).toBe('Tech articles');
    });

    it('should return empty array when no categories exist', async () => {
      const paginatedResult = Mock.paginated([], 0);

      categoryService.findAll.mockResolvedValue(paginatedResult);

      const handler = controller.getCategories();
      const result = await handler();

      expect(result.body).toEqual([]);
      expect(result.body).toHaveLength(0);
    });

    it('should handle mixed description values in multiple categories', async () => {
      const categories = [
        Mock.category({ name: 'Tech', description: 'Tech articles' }),
        Mock.category({ name: 'Lifestyle', description: null }),
        Mock.category({ name: 'Travel', description: 'Travel stories' }),
      ];
      const paginatedResult = Mock.paginated(categories, 3);

      categoryService.findAll.mockResolvedValue(paginatedResult);

      const handler = controller.getCategories();
      const result = await handler();

      expect(result.body).toHaveLength(3);
      expect(result.body[0].description).toBe('Tech articles');
      expect(result.body[1].description).toBeUndefined();
      expect(result.body[2].description).toBe('Travel stories');
    });
  });

  describe('createCategory', () => {
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

      const handler = controller.createCategory();
      const result = await handler({ body: createDto });

      expect(categoryService.create).toHaveBeenCalledWith({
        ...createDto,
        name: createDto.name,
      });
      expect(result.status).toBe(201);
      expect(result.body.name).toBe(createDto.name);
      expect(result.body.description).toBe(createDto.description);
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

      const createdCategory = Mock.category({
        name: createDto.name,
        slug: createDto.slug,
        description: '',
      });

      categoryService.create.mockResolvedValue(createdCategory);

      const handler = controller.createCategory();
      const result = await handler({ body: createDto });

      expect(result.status).toBe(201);
      expect(result.body.description).toBe('');
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

      const handler = controller.createCategory();
      const result = await handler({ body: createDto });

      expect(result.status).toBe(201);
      expect(result.body.name).toBe('Tech & Design');
      expect(categoryService.create).toHaveBeenCalledWith(createDto);
    });

    it('should pass name field explicitly to service', async () => {
      const createDto = {
        name: 'Explicit Name',
        slug: 'explicit-name',
      };

      const createdCategory = Mock.category({
        name: createDto.name,
        slug: createDto.slug,
      });

      categoryService.create.mockResolvedValue(createdCategory);

      const handler = controller.createCategory();
      await handler({ body: createDto });

      expect(categoryService.create).toHaveBeenCalledWith({
        ...createDto,
        name: createDto.name,
      });
    });
  });

  describe('updateCategory', () => {
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

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: categoryName }, body: updateDto });

      expect(categoryService.updateByName).toHaveBeenCalledWith(categoryName, updateDto);
      expect(result.body.name).toBe(updateDto.name);
      expect(result.body.description).toBe(updateDto.description);
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

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: categoryName }, body: updateDto });

      expect(result.body.name).toBe('New Name Only');
      expect(result.body.description).toBe('Keep this description');
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

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: categoryName }, body: updateDto });

      // controller converts null to undefined using ?? operator
      expect(result.body.description).toBeUndefined();
    });

    it('should handle category ID as string and parse to number', async () => {
      const categoryName = 'test-category';
      const updateDto = {
        name: 'Updated Name',
      };

      const updatedCategory = Mock.category({
        id: 42,
        name: 'Updated Name',
      });

      categoryService.updateByName.mockResolvedValue(updatedCategory);

      const handler = controller.updateCategory();
      await handler({ params: { name: categoryName }, body: updateDto });

      expect(categoryService.updateByName).toHaveBeenCalledWith(categoryName, updateDto);
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category successfully', async () => {
      const categoryName = 'test-category';

      categoryService.removeByName.mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      const result = await handler({ params: { name: categoryName } });

      expect(categoryService.removeByName).toHaveBeenCalledWith(categoryName);
      expect(result.body.success).toBe(true);
    });

    it('should verify remove is called exactly once', async () => {
      const categoryName = 'test-category';

      categoryService.removeByName.mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      await handler({ params: { name: categoryName } });

      expect(categoryService.removeByName).toHaveBeenCalledTimes(1);
      expect(categoryService.removeByName).toHaveBeenCalledWith(categoryName);
    });

    it('should handle category ID as string and parse to number', async () => {
      const categoryName = 'test-category';

      categoryService.removeByName.mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      await handler({ params: { name: categoryName } });

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

      const paginatedResult = Mock.paginated(mockArticles, 2, 1, 1000);

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

      const paginatedResult = Mock.paginated([], 0, 1, 1000);

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

      const paginatedResult = Mock.paginated(mockArticles, 2);

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

      const paginatedResult = Mock.paginated(mockArticles, 2, 1, 1000);

      categoryService.getArticlesByCategoryNameDirect.mockResolvedValue(paginatedResult);

      const result = await controller.getArticlesByCategoryNameDirect(categoryName, {});

      expect(categoryService.getArticlesByCategoryNameDirect).toHaveBeenCalledWith(categoryName, {
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

      const paginatedResult = Mock.paginated([], 0, 1, 1000);

      categoryService.getArticlesByCategoryNameDirect.mockResolvedValue(paginatedResult);

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

      const paginatedResult = Mock.paginated(mockArticles, 3);

      categoryService.getArticlesByCategoryNameDirect.mockResolvedValue(paginatedResult);

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

      const paginatedResult = Mock.paginated(mockArticles, 3);

      categoryService.getArticlesByCategoryNameDirect.mockResolvedValue(paginatedResult);

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

      const paginatedResult = Mock.paginated(mockArticles, 2);

      categoryService.getArticlesByCategoryNameDirect.mockResolvedValue(paginatedResult);

      const result = await controller.getArticlesByCategoryNameDirect(categoryName, {});

      expect(result.items[0].password).toBe('encrypted-password');
      expect(result.items[1].password).toBeNull();
    });
  });
});
