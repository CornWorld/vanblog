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
      const categoryId = '1';
      const updateDto = {
        name: 'Updated Category',
        description: 'Updated description',
      };

      const updatedCategory = createMockCategory({
        id: 1,
        name: updateDto.name,
        description: updateDto.description,
      });

      categoryService.update.mockResolvedValue(updatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { id: categoryId }, body: updateDto });

      expect(categoryService.update).toHaveBeenCalledWith(1, updateDto);
      expect(result.status).toBe(200);
      expect(result.body.name).toBe(updateDto.name);
      expect(result.body.description).toBe(updateDto.description);
    });

    it('should update only name field', async () => {
      const categoryId = '1';
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

      categoryService.update.mockResolvedValue(updatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { id: categoryId }, body: updateDto });

      expect(result.status).toBe(200);
      expect(result.body.name).toBe('New Name Only');
      expect(result.body.description).toBe('Keep this description');
      expect(categoryService.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('should update description to null (converted to undefined)', async () => {
      const categoryId = '1';
      const updateDto = {
        description: null,
      };

      const updatedCategory = Mock.category({
        id: 1,
        name: 'Category',
        description: null,
      });

      categoryService.update.mockResolvedValue(updatedCategory);

      const handler = controller.updateCategory();
      const result = await handler({ params: { id: categoryId }, body: updateDto });

      expect(result.status).toBe(200);
      expect(result.body.description).toBeUndefined();
    });

    it('should handle category ID as string and parse to number', async () => {
      const categoryId = '42';
      const updateDto = {
        name: 'Updated Name',
      };

      const updatedCategory = Mock.category({
        id: 42,
        name: 'Updated Name',
      });

      categoryService.update.mockResolvedValue(updatedCategory);

      const handler = controller.updateCategory();
      await handler({ params: { id: categoryId }, body: updateDto });

      expect(categoryService.update).toHaveBeenCalledWith(42, updateDto);
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category successfully', async () => {
      const categoryId = '1';

      categoryService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      const result = await handler({ params: { id: categoryId } });

      expect(categoryService.remove).toHaveBeenCalledWith(1);
      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
    });

    it('should verify remove is called exactly once', async () => {
      const categoryId = '1';

      categoryService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      await handler({ params: { id: categoryId } });

      expect(categoryService.remove).toHaveBeenCalledTimes(1);
      expect(categoryService.remove).toHaveBeenCalledWith(1);
    });

    it('should handle category ID as string and parse to number', async () => {
      const categoryId = '42';

      categoryService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteCategory();
      await handler({ params: { id: categoryId } });

      expect(categoryService.remove).toHaveBeenCalledWith(42);
    });
  });

  describe('getArticlesByCategory', () => {
    it('should return articles in a category', async () => {
      const categoryId = '1';

      const mockArticles = Mock.articles(2, {
        category: 'Technology',
        tags: ['tag1', 'tag2'],
      });

      const paginatedResult = Mock.paginated(mockArticles, 2, 1, 1000);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { id: categoryId } });

      expect(categoryService.getArticlesByCategoryId).toHaveBeenCalledWith(1, {
        page: 1,
        pageSize: 1000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(2);
    });

    it('should return empty array when category has no articles', async () => {
      const categoryId = '1';

      const paginatedResult = Mock.paginated([], 0, 1, 1000);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { id: categoryId } });

      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(0);
      expect(result.body.items).toEqual([]);
    });

    it('should correctly map article viewer count to views', async () => {
      const categoryId = '1';

      const mockArticles = [
        Mock.article({ viewer: 100 }),
        Mock.article({ viewer: null }),
        Mock.article({ viewer: 0 }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 3);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { id: categoryId } });

      expect(result.body.items[0].views).toBe(100);
      expect(result.body.items[1].views).toBe(0);
      expect(result.body.items[2].views).toBe(0);
    });

    it('should correctly map top field to isTop', async () => {
      const categoryId = '1';

      const mockArticles = [
        Mock.article({ top: 5 }),
        Mock.article({ top: 0 }),
        Mock.article({ top: null }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 3);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { id: categoryId } });

      expect(result.body.items[0].isTop).toBe(true);
      expect(result.body.items[1].isTop).toBe(false);
      expect(result.body.items[2].isTop).toBe(false);
    });

    it('should preserve password when present', async () => {
      const categoryId = '1';

      const mockArticles = [
        Mock.article({ password: 'encrypted-password' }),
        Mock.article({ password: null }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 2);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { id: categoryId } });

      expect(result.body.items[0].password).toBe('encrypted-password');
      expect(result.body.items[1].password).toBeUndefined();
    });

    it('should map article fields correctly', async () => {
      const categoryId = '1';

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

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { id: categoryId } });

      const mappedArticle = result.body.items[0];

      expect(mappedArticle.id).toBe(1);
      expect(mappedArticle.title).toBe('Article 1');
      expect(mappedArticle.content).toBe('Content 1');
      expect(mappedArticle.summary).toBeUndefined();
      expect(mappedArticle.cover).toBeUndefined();
      expect(mappedArticle.category).toBeUndefined();
      expect(mappedArticle.tags).toBeUndefined();
      expect(mappedArticle.views).toBe(50);
      expect(mappedArticle.likes).toBe(0);
      expect(mappedArticle.isTop).toBe(false);
      expect(mappedArticle.isHot).toBe(false);
      expect(mappedArticle.private).toBe(false); // password is null, so private should be false
      expect(mappedArticle.password).toBeUndefined();
      expect(mappedArticle.toc).toBeUndefined();
    });

    it('should handle multiple articles with different field values', async () => {
      const categoryId = '1';

      const mockArticles = [
        Mock.article({ id: 1, top: 5, viewer: 100, category: 'Tech' }),
        Mock.article({ id: 2, top: 0, viewer: 50, category: null }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 2);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { id: categoryId } });

      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(2);

      expect(result.body.items[0].id).toBe(1);
      expect(result.body.items[0].isTop).toBe(true);
      expect(result.body.items[0].views).toBe(100);

      expect(result.body.items[1].id).toBe(2);
      expect(result.body.items[1].isTop).toBe(false);
      expect(result.body.items[1].views).toBe(50);
    });

    it('should handle articles with null tags and category fields', async () => {
      const categoryId = '1';

      const article = Mock.article({
        tags: null,
        category: null,
      });

      const paginatedResult = Mock.paginated([article], 1);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      const result = await handler({ params: { id: categoryId } });

      expect(result.body.items[0].category).toBeUndefined();
      expect(result.body.items[0].tags).toBeUndefined();
    });

    it('should handle category ID as string and parse to number', async () => {
      const categoryId = '42';

      const mockArticles = Mock.articles(1);

      const paginatedResult = Mock.paginated(mockArticles, 1);

      categoryService.getArticlesByCategoryId.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategory();
      await handler({ params: { id: categoryId } });

      expect(categoryService.getArticlesByCategoryId).toHaveBeenCalledWith(42, {
        page: 1,
        pageSize: 1000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });
  });

  describe('getCategoryById', () => {
    it('should return category by ID', async () => {
      const categoryId = '1';
      const mockCategory = Mock.category({ id: 1, name: 'Test Category' });

      categoryService.findOne.mockResolvedValue(mockCategory);

      const handler = controller.getCategoryById();
      const result = await handler({ params: { id: categoryId } });

      expect(categoryService.findOne).toHaveBeenCalledWith(1);
      expect(result.status).toBe(200);
      expect(result.body.name).toBe('Test Category');
    });

    it('should handle category ID as string and parse to number', async () => {
      const categoryId = '42';
      const mockCategory = Mock.category({ id: 42, name: 'Category 42' });

      categoryService.findOne.mockResolvedValue(mockCategory);

      const handler = controller.getCategoryById();
      await handler({ params: { id: categoryId } });

      expect(categoryService.findOne).toHaveBeenCalledWith(42);
    });
  });

  describe('getArticlesByCategoryName', () => {
    it('should return articles by category name', async () => {
      const categoryName = 'Technology';

      const mockArticles = Mock.articles(2, {
        category: categoryName,
        tags: ['tag1', 'tag2'],
      });

      const paginatedResult = Mock.paginated(mockArticles, 2, 1, 1000);

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategoryName();
      const result = await handler({ params: { name: categoryName } });

      expect(categoryService.getArticlesByCategoryName).toHaveBeenCalledWith(categoryName, {
        page: 1,
        pageSize: 1000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(2);
    });

    it('should return empty array when category has no articles', async () => {
      const categoryName = 'Empty';

      const paginatedResult = Mock.paginated([], 0, 1, 1000);

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategoryName();
      const result = await handler({ params: { name: categoryName } });

      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(0);
      expect(result.body.items).toEqual([]);
    });

    it('should correctly map article viewer count to views', async () => {
      const categoryName = 'Tech';

      const mockArticles = [
        Mock.article({ viewer: 100 }),
        Mock.article({ viewer: null }),
        Mock.article({ viewer: 0 }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 3);

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategoryName();
      const result = await handler({ params: { name: categoryName } });

      expect(result.body.items[0].views).toBe(100);
      expect(result.body.items[1].views).toBe(0);
      expect(result.body.items[2].views).toBe(0);
    });

    it('should correctly map top field to isTop', async () => {
      const categoryName = 'Tech';

      const mockArticles = [
        Mock.article({ top: 5 }),
        Mock.article({ top: 0 }),
        Mock.article({ top: null }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 3);

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategoryName();
      const result = await handler({ params: { name: categoryName } });

      expect(result.body.items[0].isTop).toBe(true);
      expect(result.body.items[1].isTop).toBe(false);
      expect(result.body.items[2].isTop).toBe(false);
    });

    it('should preserve password when present', async () => {
      const categoryName = 'Tech';

      const mockArticles = [
        Mock.article({ password: 'encrypted-password' }),
        Mock.article({ password: null }),
      ];

      const paginatedResult = Mock.paginated(mockArticles, 2);

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategoryName();
      const result = await handler({ params: { name: categoryName } });

      expect(result.body.items[0].password).toBe('encrypted-password');
      expect(result.body.items[1].password).toBeUndefined();
    });

    it('should map article fields correctly', async () => {
      const categoryName = 'Tech';

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

      categoryService.getArticlesByCategoryName.mockResolvedValue(paginatedResult);

      const handler = controller.getArticlesByCategoryName();
      const result = await handler({ params: { name: categoryName } });

      const mappedArticle = result.body.items[0];

      expect(mappedArticle.id).toBe(1);
      expect(mappedArticle.title).toBe('Article 1');
      expect(mappedArticle.content).toBe('Content 1');
      expect(mappedArticle.summary).toBeUndefined();
      expect(mappedArticle.cover).toBeUndefined();
      expect(mappedArticle.category).toBeUndefined();
      expect(mappedArticle.tags).toBeUndefined();
      expect(mappedArticle.views).toBe(50);
      expect(mappedArticle.likes).toBe(0);
      expect(mappedArticle.isTop).toBe(false);
      expect(mappedArticle.isHot).toBe(false);
      expect(mappedArticle.private).toBe(false); // password is null, so private should be false
      expect(mappedArticle.password).toBeUndefined();
      expect(mappedArticle.toc).toBeUndefined();
    });
  });
});
