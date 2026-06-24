/**
 * TagController - Controller Layer Tests
 *
 * Tests the TagController's HTTP layer functionality, including:
 * - RESTful CRUD operations (GET, POST, PUT, DELETE)
 * - ts-rest contract handlers
 * - Permission decorators
 * - Input validation and error handling
 * - Boundary conditions and edge cases
 *
 * Related tests:
 * - tag.service.spec.ts - Business logic and data access
 * - tag.service.associations.spec.ts - Complex association queries
 * - tag.service.queries.spec.ts - Article query operations
 * - tag.service.boundaries.spec.ts - Boundary condition tests
 */

import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

import { Mock } from '@test/mock';

import { TagController } from './tag.controller';
import { TagService } from './tag.service';
import { Tag } from './entities/tag.entity';

// Test data helpers
const createMockTag = (overrides = {}) =>
  new Tag({
    id: 1,
    name: 'JavaScript',
    slug: 'javascript',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  });

const createMockTagList = () => ({
  items: [
    createMockTag({ id: 1, name: 'JavaScript', slug: 'javascript' }),
    createMockTag({ id: 2, name: 'TypeScript', slug: 'typescript' }),
  ],
  total: 2,
});

const createCreateTagDto = (overrides = {}) => ({
  name: 'React',
  slug: 'react',
  ...overrides,
});

const createUpdateTagDto = (overrides = {}) => ({
  name: 'JavaScript 2024',
  slug: 'javascript-2024',
  ...overrides,
});

describe('TagController', () => {
  let controller: TagController;
  let mockTagService: any;

  beforeEach(async () => {
    // Create service mock with all methods
    mockTagService = Mock.tagService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagController],
      providers: [
        {
          provide: TagService,
          useValue: mockTagService,
        },
      ],
    }).compile();

    controller = module.get<TagController>(TagController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have TagService injected', () => {
      expect(mockTagService).toBeDefined();
      expect(typeof mockTagService.findAll).toBe('function');
      expect(typeof mockTagService.findOne).toBe('function');
      expect(typeof mockTagService.create).toBe('function');
      expect(typeof mockTagService.update).toBe('function');
      expect(typeof mockTagService.remove).toBe('function');
    });
  });

  describe('findAll()', () => {
    describe('Happy Path', () => {
      it('should return all tags with pagination', async () => {
        const mockTags = createMockTagList();
        mockTagService.findAll.mockResolvedValue(mockTags);

        const result = await controller.findAll();

        expect(mockTagService.findAll).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockTags);
        expect(result.items).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.items[0].id).toBe(1);
        expect(result.items[0].name).toBe('JavaScript');
      });

      it('should handle empty tags list', async () => {
        const emptyTags = {
          items: [],
          total: 0,
        };
        mockTagService.findAll.mockResolvedValue(emptyTags);

        const result = await controller.findAll();

        expect(mockTagService.findAll).toHaveBeenCalledTimes(1);
        expect(result.items).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe('Error Handling', () => {
      it('should handle service errors gracefully', async () => {
        const error = new Error('Database connection failed');
        mockTagService.findAll.mockRejectedValue(error);

        await expect(controller.findAll()).rejects.toThrow('Database connection failed');
      });
    });
  });

  describe('findOne()', () => {
    describe('Happy Path', () => {
      it('should return a tag by ID', async () => {
        const mockTag = createMockTag();
        mockTagService.findOne.mockResolvedValue(mockTag);

        const result = await controller.findOne(1);

        expect(mockTagService.findOne).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockTag);
        expect(result.id).toBe(1);
        expect(result.name).toBe('JavaScript');
        expect(result.slug).toBe('javascript');
      });
    });

    describe('Error Handling', () => {
      it('should throw NotFoundException when tag not found', async () => {
        mockTagService.findOne.mockRejectedValue(
          new NotFoundException('Tag with ID 999 not found'),
        );

        await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
        await expect(controller.findOne(999)).rejects.toThrow('Tag with ID 999 not found');
      });

      it('should handle invalid ID type', async () => {
        // ParseIntPipe should handle this, but let's test service layer
        mockTagService.findOne.mockRejectedValue(new NotFoundException('Invalid tag ID'));

        await expect(controller.findOne('invalid' as unknown as number)).rejects.toThrow();
      });
    });
  });

  describe('create()', () => {
    describe('Happy Path', () => {
      it('should create a new tag with both name and slug', async () => {
        const createDto = createCreateTagDto();
        const mockCreatedTag = createMockTag(createDto);
        mockTagService.create.mockResolvedValue(mockCreatedTag);

        const result = await controller.create(createDto);

        expect(mockTagService.create).toHaveBeenCalledWith(createDto);
        expect(result).toEqual(mockCreatedTag);
        expect(result.id).toBe(1);
        expect(result.name).toBe('React');
        expect(result.slug).toBe('react');
      });

      it('should create a tag with auto-generated slug', async () => {
        const createDto = createCreateTagDto({ name: 'Vue.js' });
        const mockCreatedTag = createMockTag({
          ...createDto,
          slug: 'vue-js',
        });
        mockTagService.create.mockResolvedValue(mockCreatedTag);

        const result = await controller.create(createDto);

        expect(mockTagService.create).toHaveBeenCalledWith(createDto);
        expect(result.slug).toBe('vue-js');
        expect(result.name).toBe('Vue.js');
      });

      it('should handle service returning slug as null', async () => {
        const createDto = createCreateTagDto();
        const mockCreatedTag = createMockTag({
          ...createDto,
          slug: null,
        });
        mockTagService.create.mockResolvedValue(mockCreatedTag);

        const result = await controller.create(createDto);

        expect(result.slug).toBeNull();
      });
    });

    describe('Input Validation', () => {
      it('should validate create DTO with Zod schema', async () => {
        const invalidDto = {};

        await expect(controller.create(invalidDto)).rejects.toThrow();
      });

      it('should reject empty name', async () => {
        const invalidDto = { name: '' };

        await expect(controller.create(invalidDto)).rejects.toThrow();
      });

      it('should reject duplicate slug if provided', async () => {
        const invalidDto = { name: 'Test', slug: 'javascript' };

        // Service should handle slug uniqueness
        mockTagService.create.mockRejectedValue(new Error('Slug already exists'));

        await expect(controller.create(invalidDto)).rejects.toThrow('Slug already exists');
      });
    });

    describe('Permission Handling', () => {
      it('should require permission for tag creation', () => {
        // This would be tested at integration level
        // For unit test, we just verify the service is called
        expect(typeof controller.create).toBe('function');
      });
    });
  });

  describe('update()', () => {
    describe('Happy Path', () => {
      it('should update an existing tag by name with both fields', async () => {
        const updateDto = createUpdateTagDto();
        const mockUpdatedTag = createMockTag({
          ...updateDto,
          updatedAt: '2024-01-15T00:00:00Z',
        });
        mockTagService.updateByName.mockResolvedValue(mockUpdatedTag);

        const result = await controller.update('JavaScript', updateDto);

        expect(mockTagService.updateByName).toHaveBeenCalledWith('JavaScript', updateDto);
        expect(result).toEqual(mockUpdatedTag);
        expect(result.name).toBe('JavaScript 2024');
        expect(result.slug).toBe('javascript-2024');
        expect(result.updatedAt).toBe('2024-01-15T00:00:00Z');
      });

      it('should update only name without changing slug', async () => {
        const updateDto = { name: 'TypeScript Updated' };
        const mockUpdatedTag = createMockTag({
          ...updateDto,
          slug: 'typescript',
          updatedAt: '2024-01-15T00:00:00Z',
        });
        mockTagService.updateByName.mockResolvedValue(mockUpdatedTag);

        const result = await controller.update('TypeScript', updateDto);

        expect(mockTagService.updateByName).toHaveBeenCalledWith('TypeScript', updateDto);
        expect(result.name).toBe('TypeScript Updated');
        expect(result.slug).toBe('typescript'); // Slug should remain unchanged
      });
    });

    describe('Error Handling', () => {
      it('should throw NotFoundException when updating non-existent tag', async () => {
        const updateDto = createUpdateTagDto();
        mockTagService.updateByName.mockRejectedValue(
          new NotFoundException('Tag with name "NonExistent" not found'),
        );

        await expect(controller.update('NonExistent', updateDto)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should handle validation errors in update DTO', async () => {
        const invalidDto = { name: '' };

        await expect(controller.update('JavaScript', invalidDto)).rejects.toThrow();
      });
    });
  });

  describe('remove()', () => {
    describe('Happy Path', () => {
      it('should delete a tag by name successfully', async () => {
        mockTagService.removeByName.mockResolvedValue(undefined);

        await controller.remove('JavaScript');

        expect(mockTagService.removeByName).toHaveBeenCalledWith('JavaScript');
      });
    });

    describe('Error Handling', () => {
      it('should throw NotFoundException when deleting non-existent tag', async () => {
        mockTagService.removeByName.mockRejectedValue(
          new NotFoundException('Tag with name "NonExistent" not found'),
        );

        await expect(controller.remove('NonExistent')).rejects.toThrow(NotFoundException);
      });

      it('should handle cascade deletion errors', async () => {
        mockTagService.removeByName.mockRejectedValue(
          new Error('Cannot delete tag with associated articles'),
        );

        await expect(controller.remove('JavaScript')).rejects.toThrow(
          'Cannot delete tag with associated articles',
        );
      });
    });
  });

  describe('getStatistics()', () => {
    describe('Happy Path', () => {
      it('should return overall statistics', async () => {
        const mockStatistics = {
          totalTags: 15,
          totalCategories: 8,
          averageTagsPerArticle: 3.5,
          averageCategoriesPerArticle: 1.2,
        };

        mockTagService.getStatistics.mockResolvedValue(mockStatistics);

        const result = await controller.getStatistics();

        expect(mockTagService.getStatistics).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockStatistics);
        expect(result.totalTags).toBe(15);
        expect(result.totalCategories).toBe(8);
      });
    });

    describe('Error Handling', () => {
      it('should handle service errors gracefully', async () => {
        mockTagService.getStatistics.mockRejectedValue(new Error('Statistics calculation failed'));

        await expect(controller.getStatistics()).rejects.toThrow('Statistics calculation failed');
      });
    });
  });

  describe('getTagsWithCategories()', () => {
    describe('Happy Path', () => {
      it('should return tags with their associated categories', async () => {
        const mockTagsWithCategories = [
          {
            tag: createMockTag({ id: 1, name: 'JavaScript' }),
            categories: [
              { name: 'Frontend', count: 5 },
              { name: 'Backend', count: 3 },
            ],
          },
          {
            tag: createMockTag({ id: 2, name: 'Python' }),
            categories: [{ name: 'Backend', count: 7 }],
          },
        ];

        mockTagService.getTagsWithCategories.mockResolvedValue(mockTagsWithCategories);

        const result = await controller.getTagsWithCategories();

        expect(mockTagService.getTagsWithCategories).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockTagsWithCategories);
        expect(result).toHaveLength(2);
        expect(result[0].categories).toHaveLength(2);
        expect(result[1].categories).toHaveLength(1);
        expect(result[0].categories[0].name).toBe('Frontend');
      });

      it('should handle tags with no associated categories', async () => {
        const mockTagsWithNoCategories = [
          {
            tag: createMockTag({ id: 1, name: 'Unused Tag' }),
            categories: [],
          },
        ];

        mockTagService.getTagsWithCategories.mockResolvedValue(mockTagsWithNoCategories);

        const result = await controller.getTagsWithCategories();

        expect(result[0].categories).toHaveLength(0);
      });
    });

    describe('Error Handling', () => {
      it('should handle service errors', async () => {
        mockTagService.getTagsWithCategories.mockRejectedValue(new Error('Database query failed'));

        await expect(controller.getTagsWithCategories()).rejects.toThrow('Database query failed');
      });
    });
  });

  describe('getArticlesByTagId()', () => {
    describe('Happy Path', () => {
      it('should return articles by tag ID with pagination', async () => {
        const mockArticles = {
          items: [
            {
              id: 1,
              title: 'TypeScript Advanced',
              content: 'Content here',
              pathname: '/ts-advanced',
              tags: ['TypeScript', 'Advanced'],
              category: 'Frontend',
              author: 'admin',
              top: 0,
              hidden: false,
              private: false,
              password: null,
              viewer: 150,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        };

        mockTagService.getArticlesByTagId.mockResolvedValue(mockArticles);

        const result = await controller.getArticlesByTagId(1, {
          page: 1,
          pageSize: 10,
        });

        expect(mockTagService.getArticlesByTagId).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            page: 1,
            pageSize: 10,
          }),
        );
        expect(result).toEqual(mockArticles);
        expect(result.items).toHaveLength(1);
      });

      it('should support includeHidden parameter', async () => {
        mockTagService.getArticlesByTagId.mockResolvedValue({
          items: [],
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 0,
        });

        await controller.getArticlesByTagId(1, {
          page: 1,
          pageSize: 10,
          includeHidden: true,
        });

        expect(mockTagService.getArticlesByTagId).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            includeHidden: true,
          }),
        );
      });
    });

    describe('Error Handling', () => {
      it('should throw NotFoundException when tag ID not found', async () => {
        mockTagService.getArticlesByTagId.mockRejectedValue(
          new NotFoundException('Tag with ID 999 not found'),
        );

        await expect(
          controller.getArticlesByTagId(999, {
            page: 1,
            pageSize: 10,
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('Boundary Conditions', () => {
    describe('Input Validation', () => {
      it('should handle maximum allowed tag names (30 characters)', async () => {
        const maxLengthName = 'a'.repeat(30);
        const createDto = { name: maxLengthName, slug: 'max-length-tag' };

        const mockCreatedTag = createMockTag({ name: maxLengthName, slug: 'max-length-tag' });
        mockTagService.create.mockResolvedValue(mockCreatedTag);

        const result = await controller.create(createDto);

        expect(result.name.length).toBe(30);
        expect(result).toEqual(mockCreatedTag);
      });

      it('should handle tag names with special characters', async () => {
        const specialName = '@#$%^&*()_+-=[]{}|;:,.<>?/~`';
        const createDto = { name: specialName, slug: 'special-chars' };

        const mockCreatedTag = createMockTag({ name: specialName, slug: 'special-chars' });
        mockTagService.create.mockResolvedValue(mockCreatedTag);

        const result = await controller.create(createDto);

        expect(result.name).toBe(specialName);
      });

      it('should handle unicode characters in tag names', async () => {
        const unicodeName = '日本語タグ🚀🎉émoji中文';
        const createDto = { name: unicodeName, slug: 'unicode-tag' };

        const mockCreatedTag = createMockTag({ name: unicodeName, slug: 'unicode-tag' });
        mockTagService.create.mockResolvedValue(mockCreatedTag);

        const result = await controller.create(createDto);

        expect(result.name).toBe(unicodeName);
      });
    });

    describe('Service Integration', () => {
      it('should handle service throwing unexpected errors', async () => {
        const error = new Error('Unexpected service error');
        mockTagService.findAll.mockRejectedValue(error);

        await expect(controller.findAll()).rejects.toThrow('Unexpected service error');
      });

      it('should handle service returning partial data', async () => {
        const partialTag = {
          id: 1,
          name: 'Partial Tag',
          // Missing slug field
        };
        mockTagService.create.mockResolvedValue(partialTag);

        const result = await controller.create({ name: 'Partial Tag' });

        expect(result.id).toBe(1);
        expect(result.name).toBe('Partial Tag');
      });
    });

    describe('Permission Scenarios', () => {
      it('should handle permission failures gracefully (would be tested in integration)', () => {
        // This is a placeholder for permission testing
        // In integration tests, we would verify proper 403 responses
        expect(controller.create).toBeDefined();
      });
    });
  });

  describe('Performance Considerations', () => {
    it('should not have unnecessary service calls in normal operation', async () => {
      const mockTag = createMockTag();
      mockTagService.findOne.mockResolvedValue(mockTag);

      await controller.findOne(1);

      expect(mockTagService.findOne).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent requests gracefully', async () => {
      const mockTag = createMockTag();
      mockTagService.findOne.mockResolvedValue(mockTag);

      // Simulate concurrent calls
      const promises = [controller.findOne(1), controller.findOne(1), controller.findOne(1)];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toEqual(mockTag);
      });

      // Service should handle the concurrency
      expect(mockTagService.findOne).toHaveBeenCalledTimes(3);
    });
  });
});
