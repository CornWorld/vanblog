import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TagService } from './tag.service';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('TagService', () => {
  let service: TagService;

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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<TagService>(TagService);
  });

  describe('findAll', () => {
    it('should return all tags', async () => {
      const mockTags = [
        {
          id: 1,
          name: 'Tag1',
          slug: 'tag1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.from.mockResolvedValueOnce(mockTags);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Tag1');
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a single tag', async () => {
      const mockTag = {
        id: 1,
        name: 'Tag1',
        slug: 'tag1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockTag]);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Tag1');
    });

    it('should throw NotFoundException when tag not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new tag', async () => {
      const mockCreatedTag = {
        id: 1,
        name: 'New Tag',
        slug: 'new-tag',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedTag]);

      const createDto = {
        name: 'New Tag',
        slug: 'new-tag',
      };

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.name).toBe('New Tag');
    });
  });

  describe('update', () => {
    it('should update an existing tag', async () => {
      const mockUpdatedTag = {
        id: 1,
        name: 'Updated Tag',
        slug: 'updated-tag',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockUpdatedTag]);

      const updateDto = {
        name: 'Updated Tag',
      };

      const result = await service.update(1, updateDto);

      expect(result.name).toBe('Updated Tag');
    });

    it('should throw NotFoundException when tag not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a tag', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when tag not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
