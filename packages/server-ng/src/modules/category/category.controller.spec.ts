import { NotFoundException } from '@nestjs/common';
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
      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(3);
      expect(result.body[0]).toHaveProperty('articleCount');
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

      expect(result.status).toBe(200);
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

      expect(result.status).toBe(200);
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
      const categoryName = 'old-category';
      const updateDto = {
        name: 'Updated Category',
        description: 'Updated description',
      };

      const existingCategory = createMockCategory({
        name: 'Old Category',
        slug: categoryName,
      });

      const updatedCategory = createMockCategory({
        id: existingCategory.id,
        name: updateDto.name,
        description: updateDto.description,
      });

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.update.mockResolvedValue(updatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: categoryName }, body: updateDto });

      expect(categoryService.findByName).toHaveBeenCalledWith(categoryName);
      expect(categoryService.update).toHaveBeenCalledWith(existingCategory.id, updateDto);
      expect(result.status).toBe(200);
      expect(result.body.name).toBe(updateDto.name);
      expect(result.body.description).toBe(updateDto.description);
    });

    it('should throw NotFoundException when category not found', async () => {
      const updateDto = {
        name: 'Updated Category',
      };

      categoryService.findByName.mockResolvedValue(null);

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

      const existingCategory = createMockCategory({
        name: 'Old Name',
        slug: 'old-name',
        description: 'Keep this description',
      });

      const updatedCategory = createMockCategory({
        ...existingCategory,
        name: updateDto.name,
      });

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.update.mockResolvedValue(updatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: 'old-name' }, body: updateDto });

      expect(result.status).toBe(200);
      expect(result.body.name).toBe('New Name Only');
      expect(result.body.description).toBe('Keep this description');
      expect(categoryService.update).toHaveBeenCalledWith(existingCategory.id, updateDto);
    });

    it('should update description to null (converted to undefined)', async () => {
      const updateDto = {
        description: null,
      };

      const existingCategory = Mock.category({
        id: 1,
        name: 'Category',
        description: 'Old description',
      });

      const updatedCategory = Mock.category({
        ...existingCategory,
        description: null,
      });

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.update.mockResolvedValue(updatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: 'category' }, body: updateDto });

      expect(result.status).toBe(200);
      expect(result.body.description).toBeUndefined();
    });

    it('should handle category name with special characters', async () => {
      const categoryName = 'cpp-programming';
      const updateDto = {
        description: 'Updated description',
      };

      const existingCategory = Mock.category({
        id: 1,
        name: 'C++ Programming',
        slug: categoryName,
      });

      const updatedCategory = Mock.category({
        ...existingCategory,
        description: updateDto.description,
      });

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.update.mockResolvedValue(updatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { name: categoryName }, body: updateDto });

      expect(result.status).toBe(200);
      expect(categoryService.findByName).toHaveBeenCalledWith(categoryName);
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category successfully', async () => {
      const categoryName = 'category-to-delete';
      const existingCategory = createMockCategory({
        name: 'Category to Delete',
        slug: categoryName,
      });

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      const result = await handler({ params: { name: categoryName } });

      expect(categoryService.findByName).toHaveBeenCalledWith(categoryName);
      expect(categoryService.remove).toHaveBeenCalledWith(existingCategory.id);
      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
    });

    it('should throw NotFoundException when category not found', async () => {
      categoryService.findByName.mockResolvedValue(null);

      const handler = controller.deleteCategory();

      await expect(handler({ params: { name: 'non-existent' } })).rejects.toThrow(
        NotFoundException,
      );
      await expect(handler({ params: { name: 'non-existent' } })).rejects.toThrow(
        'Category non-existent not found',
      );
    });

    it('should delete category with special characters in name', async () => {
      const categoryName = 'cpp-java';
      const existingCategory = createMockCategory({
        name: 'C++ & Java',
        slug: categoryName,
      });

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      const result = await handler({ params: { name: categoryName } });

      expect(categoryService.findByName).toHaveBeenCalledWith(categoryName);
      expect(categoryService.remove).toHaveBeenCalledWith(existingCategory.id);
      expect(result.body.success).toBe(true);
    });

    it('should verify remove is called exactly once', async () => {
      const existingCategory = createMockCategory({
        name: 'Test Category',
        slug: 'test-category',
      });

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      await handler({ params: { name: 'test-category' } });

      expect(categoryService.remove).toHaveBeenCalledTimes(1);
      expect(categoryService.remove).toHaveBeenCalledWith(existingCategory.id);
    });
  });

  describe('getArticlesByCategory', () => {
    it('should return articles in a category', async () => {
      const categoryName = 'Technology';
      const existingCategory = createMockCategory({
        name: categoryName,
      });

      // ✅ 优化：使用新的扁平化 Mock API
      const mockArticles = Mock.articles(2, {
        category: categoryName,
        tags: ['tag1', 'tag2'],
      });

      const paginatedResult = Mock.paginated(mockArticles, 2, 1, 1000);

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: categoryName } });

      expect(categoryService.findByName).toHaveBeenCalledWith(categoryName);
      expect(categoryService.getArticlesByCategoryId).toHaveBeenCalledWith(existingCategory.id, {
        page: 1,
        pageSize: 1000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(2);
    });

    it('should return empty array when category has no articles', async () => {
      const existingCategory = Mock.category({
        id: 1,
        name: 'Empty Category',
      });

      const paginatedResult = Mock.paginated([], 0, 1, 1000);

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'Empty Category' } });

      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(0);
      expect(result.body).toEqual([]);
    });

    it('should correctly map article viewer count to views', async () => {
      const existingCategory = Mock.category({ id: 1 });

      const mockArticles = [
        Mock.article({ viewer: 100 }),
        Mock.article({ viewer: null }),
        Mock.article({ viewer: 0 }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 3);

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'test' } });

      expect(result.body[0].views).toBe(100);
      expect(result.body[1].views).toBe(0); // null → 0
      expect(result.body[2].views).toBe(0);
    });

    it('should correctly map top field to isTop', async () => {
      const existingCategory = Mock.category({ id: 1 });

      const mockArticles = [
        Mock.article({ top: 5 }),
        Mock.article({ top: 0 }),
        Mock.article({ top: null }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 3);

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'test' } });

      expect(result.body[0].isTop).toBe(true); // top > 0
      expect(result.body[1].isTop).toBe(false); // top === 0
      expect(result.body[2].isTop).toBe(false); // top === null
    });

    it('should preserve password when present', async () => {
      const existingCategory = Mock.category({ id: 1 });

      const mockArticles = [
        Mock.article({ password: 'encrypted-password' }),
        Mock.article({ password: null }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 2);

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'test' } });

      expect(result.body[0].password).toBe('encrypted-password');
      expect(result.body[1].password).toBeUndefined(); // null → undefined
    });

    it('should throw NotFoundException when category not found', async () => {
      categoryService.findByName.mockResolvedValue(null);

      const handler = controller.getArticlesByCategory();

      await expect(handler({ params: { name: 'non-existent' } })).rejects.toThrow(
        NotFoundException,
      );
      await expect(handler({ params: { name: 'non-existent' } })).rejects.toThrow(
        'Category non-existent not found',
      );
    });

    it('should map article fields correctly', async () => {
      const existingCategory = Mock.category({ id: 1 });

      const article = Mock.article({
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
      });

      const paginatedResult = Mock.paginated([article], 1);

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'test' } });

      const mappedArticle = result.body[0];

      expect(mappedArticle.id).toBe(1);
      expect(mappedArticle.title).toBe('Article 1');
      expect(mappedArticle.content).toBe('Content 1');
      expect(mappedArticle.summary).toBeUndefined();
      expect(mappedArticle.cover).toBeUndefined();
      expect(mappedArticle.category).toBeUndefined(); // null → undefined
      expect(mappedArticle.tags).toBeUndefined(); // ['tag1'] → undefined (controller logic)
      expect(mappedArticle.views).toBe(50);
      expect(mappedArticle.likes).toBe(0);
      expect(mappedArticle.isTop).toBe(false);
      expect(mappedArticle.isHot).toBe(false);
      expect(mappedArticle.private).toBe(true);
      expect(mappedArticle.password).toBeUndefined();
      expect(mappedArticle.toc).toBeUndefined();
    });

    it('should handle multiple articles with different field values', async () => {
      const existingCategory = Mock.category({ id: 1 });

      const mockArticles = [
        Mock.article({ id: 1, top: 5, viewer: 100, category: 'Tech' }),
        Mock.article({ id: 2, top: 0, viewer: 50, category: null }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 2);

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'test' } });

      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(2);

      expect(result.body[0].id).toBe(1);
      expect(result.body[0].isTop).toBe(true);
      expect(result.body[0].views).toBe(100);

      expect(result.body[1].id).toBe(2);
      expect(result.body[1].isTop).toBe(false);
      expect(result.body[1].views).toBe(50);
    });

    it('should handle articles with null tags and category fields', async () => {
      const existingCategory = Mock.category({ id: 1 });

      const article = Mock.article({
        tags: null,
        category: null,
      });

      const paginatedResult = Mock.paginated([article], 1);

      categoryService.findByName.mockResolvedValue(existingCategory as any);
      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { name: 'test' } });

      expect(result.body[0].category).toBeUndefined();
      expect(result.body[0].tags).toBeUndefined();
    });
  });
});
