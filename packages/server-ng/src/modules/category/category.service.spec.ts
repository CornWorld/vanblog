import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoryService } from './category.service';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('CategoryService', () => {
  let service: CategoryService;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('findAll', () => {
    it('should return categories with article count', async () => {
      const mockCategories = [
        {
          id: 1,
          name: 'Technology',
          slug: 'tech',
          description: 'Tech articles',
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          articleCount: 5,
        },
      ];

      mockDb.groupBy.mockResolvedValueOnce(mockCategories);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Technology');
      expect(result.data[0].articleCount).toBe(5);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a single category', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: 'Tech articles',
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockCategory]);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Technology');
    });

    it('should throw NotFoundException when category not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const mockCreatedCategory = {
        id: 1,
        name: 'New Category',
        slug: 'new-category',
        description: 'New category description',
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedCategory]);

      const createDto = {
        name: 'New Category',
        slug: 'new-category',
        description: 'New category description',
      };

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.name).toBe('New Category');
    });
  });

  describe('update', () => {
    it('should update an existing category', async () => {
      const mockUpdatedCategory = {
        id: 1,
        name: 'Updated Category',
        slug: 'updated-category',
        description: 'Updated description',
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockUpdatedCategory]);

      const updateDto = {
        name: 'Updated Category',
        description: 'Updated description',
      };

      const result = await service.update(1, updateDto);

      expect(result.name).toBe('Updated Category');
      expect(result.description).toBe('Updated description');
    });

    it('should throw NotFoundException when category not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a category', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when category not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
