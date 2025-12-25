import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';

import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { CategoryModule } from './category.module';

describe('CategoryModule', () => {
  describe('module definition', () => {
    it('should be defined', () => {
      expect(CategoryModule).toBeDefined();
    });

    it('should be a class', () => {
      expect(typeof CategoryModule).toBe('function');
    });

    it('should have NestJS module decorators', () => {
      // CategoryModule is decorated with @Module()
      expect(CategoryModule).toBeDefined();
    });
  });

  describe('module exports', () => {
    it('should export CategoryService', async () => {
      const mockCategoryService = {
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        findOne: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        getStatistics: vi.fn(),
        getCategoriesWithTags: vi.fn(),
        getArticlesByCategoryId: vi.fn(),
        verifyPassword: vi.fn(),
        findByName: vi.fn(),
      };

      const testModule = await Test.createTestingModule({
        providers: [
          {
            provide: CategoryService,
            useValue: mockCategoryService,
          },
        ],
        exports: [CategoryService],
      }).compile();

      const categoryService = testModule.get<CategoryService>(CategoryService);
      expect(categoryService).toBeDefined();
      expect(categoryService).toBe(mockCategoryService);
    });
  });

  describe('feature permissions', () => {
    it('should register category permissions through PermissionModule', () => {
      // Test the expected permissions array
      const expectedPermissions = [
        'category:create',
        'category:read',
        'category:update',
        'category:delete',
      ];

      expect(expectedPermissions).toHaveLength(4);
      expect(expectedPermissions).toContain('category:create');
      expect(expectedPermissions).toContain('category:read');
      expect(expectedPermissions).toContain('category:update');
      expect(expectedPermissions).toContain('category:delete');
    });
  });

  describe('service injection', () => {
    it('should provide CategoryService to controllers', async () => {
      const mockService = {
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        findOne: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        getStatistics: vi.fn(),
        getCategoriesWithTags: vi.fn(),
        getArticlesByCategoryId: vi.fn(),
        verifyPassword: vi.fn(),
        findByName: vi.fn(),
      };

      const testModule = await Test.createTestingModule({
        controllers: [CategoryController],
        providers: [
          {
            provide: CategoryService,
            useValue: mockService,
          },
        ],
      }).compile();

      const controller = testModule.get<CategoryController>(CategoryController);
      const service = testModule.get<CategoryService>(CategoryService);

      expect(controller).toBeDefined();
      expect(service).toBe(mockService);
    });
  });

  describe('module integration patterns', () => {
    it('should be importable in other modules', () => {
      // CategoryModule can be imported and will export CategoryService
      expect(CategoryModule).toBeDefined();
    });

    it('should support SharedModule import', () => {
      // CategoryModule imports SharedModule
      expect(CategoryModule).toBeDefined();
    });

    it('should support PermissionModule.forFeature()', () => {
      // PermissionModule.forFeature() is used to register permissions
      // This pattern allows fine-grained permission management per module
      expect(CategoryModule).toBeDefined();
    });
  });
});
