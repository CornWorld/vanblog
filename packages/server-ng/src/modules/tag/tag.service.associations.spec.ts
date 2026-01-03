/**
 * TagService - Association Queries Tests
 *
 * Tests tag associations with articles and categories.
 * Covers findOrCreateTags and getTagsWithCategories methods.
 *
 * Related tests:
 * - tag.service.spec.ts - Core CRUD operations
 * - tag.service.queries.spec.ts - Complex article queries
 * - tag.service.boundaries.spec.ts - Boundary conditions
 */
import { type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';

import { TagService } from './tag.service';

describe('TagService - Associations', () => {
  let service: TagService;
  let module: TestingModule;
  let mockDb: any;

  beforeEach(async () => {
    const databaseMockBuilder = Mock.db();
    mockDb = databaseMockBuilder.build();

    module = await MockUtils.createTagServiceTestingModule({
      service: TagService,
      dbMock: mockDb,
    }).compile();

    service = module.get<TagService>(TagService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findOrCreateTags', () => {
    it('should return existing tags without creating new ones', async () => {
      const existingTags = [
        {
          id: 1,
          name: 'Tag1',
          slug: 'tag1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'Tag2',
          slug: 'tag2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // First query: get all existing tags
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue(existingTags),
      });

      // Second query: get tags by names (IN clause)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(existingTags),
        }),
      });

      const result = await service.findOrCreateTags(['Tag1', 'Tag2']);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Tag1');
      expect(result[1].name).toBe('Tag2');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should create missing tags', async () => {
      const existingTags = [
        {
          id: 1,
          name: 'Tag1',
          slug: 'tag1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const newlyCreatedTags = [
        {
          id: 2,
          name: 'Tag2',
          slug: 'tag2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // First query: get all existing tags
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue(existingTags),
      });

      // Second query: get tags by names (IN clause)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([...existingTags, ...newlyCreatedTags]),
        }),
      });

      const result = await service.findOrCreateTags(['Tag1', 'Tag2']);

      expect(result).toHaveLength(2);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith([
        {
          name: 'Tag2',
          slug: 'tag2',
        },
      ]);
    });

    it('should create all tags when none exist', async () => {
      // First query: get all existing tags (empty)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([]),
      });

      const newTags = [
        {
          id: 1,
          name: 'NewTag1',
          slug: 'newtag1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'NewTag2',
          slug: 'newtag2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Second query: get tags by names (IN clause)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(newTags),
        }),
      });

      const result = await service.findOrCreateTags(['NewTag1', 'NewTag2']);

      expect(result).toHaveLength(2);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith([
        {
          name: 'NewTag1',
          slug: 'newtag1',
        },
        {
          name: 'NewTag2',
          slug: 'newtag2',
        },
      ]);
    });

    it('should handle tags with spaces in names', async () => {
      // First query: get all existing tags (empty)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([]),
      });

      const newTags = [
        {
          id: 1,
          name: 'New Tag With Spaces',
          slug: 'new-tag-with-spaces',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Second query: get tags by names (IN clause)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(newTags),
        }),
      });

      await service.findOrCreateTags(['New Tag With Spaces']);

      expect(mockDb.values).toHaveBeenCalledWith([
        {
          name: 'New Tag With Spaces',
          slug: 'new-tag-with-spaces',
        },
      ]);
    });
  });

  describe('getTagsWithCategories', () => {
    it('should return tags with their categories', async () => {
      const mockTags = [
        { id: 1, name: 'Tag1', slug: 'tag1', createdAt: new Date(), updatedAt: new Date() },
        { id: 2, name: 'Tag2', slug: 'tag2', createdAt: new Date(), updatedAt: new Date() },
      ];

      const mockCategories1 = [
        { category: 'Category1', count: 2 },
        { category: 'Category2', count: 1 },
      ];

      const mockCategories2 = [{ category: 'Category1', count: 3 }];

      // First query: get all tags
      mockDb.from.mockResolvedValueOnce(mockTags);

      // Mock category queries for each tag
      mockDb.groupBy.mockResolvedValueOnce(mockCategories1);
      mockDb.groupBy.mockResolvedValueOnce(mockCategories2);

      const result = await service.getTagsWithCategories();

      expect(result).toHaveLength(2);
      expect(result[0].tag.name).toBe('Tag1');
      expect(result[0].categories).toHaveLength(2);
      expect(result[0].categories[0].name).toBe('Category1');
      expect(result[0].categories[0].count).toBe(2);
      expect(result[1].tag.name).toBe('Tag2');
      expect(result[1].categories).toHaveLength(1);
    });

    it('should handle tags with no articles', async () => {
      const mockTags = [
        { id: 1, name: 'UnusedTag', slug: null, createdAt: new Date(), updatedAt: new Date() },
      ];

      mockDb.from.mockResolvedValueOnce(mockTags);
      mockDb.groupBy.mockResolvedValueOnce([]);

      const result = await service.getTagsWithCategories();

      expect(result).toHaveLength(1);
      expect(result[0].tag.name).toBe('UnusedTag');
      expect(result[0].categories).toHaveLength(0);
    });

    it('should filter out null categories', async () => {
      const mockTags = [
        { id: 1, name: 'Tag1', slug: 'tag1', createdAt: new Date(), updatedAt: new Date() },
      ];

      const mockCategories = [
        { category: null, count: 5 },
        { category: 'Category1', count: 3 },
      ];

      mockDb.from.mockResolvedValueOnce(mockTags);
      mockDb.groupBy.mockResolvedValueOnce(mockCategories);

      const result = await service.getTagsWithCategories();

      expect(result[0].categories).toHaveLength(1);
      expect(result[0].categories[0].name).toBe('Category1');
    });
  });
});
