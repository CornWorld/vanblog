import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DraftService } from './draft.service';
import { DraftVersionService } from './draft-version.service';
import { PipelineService } from '../pipeline/services/pipeline.service';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('DraftService', () => {
  let service: DraftService;
  let mockDraftVersionService: Partial<DraftVersionService>;
  let mockPipelineService: Partial<PipelineService>;
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    // Create chainable mock object
    const createChainableMock = () => {
      const mock: Record<string, ReturnType<typeof vi.fn>> = {
        select: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        limit: vi.fn(),
        offset: vi.fn(),
        insert: vi.fn(),
        values: vi.fn(),
        returning: vi.fn(),
        update: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      };

      // Make each method return the mock object for chaining
      Object.keys(mock).forEach((key) => {
        mock[key].mockReturnValue(mock);
      });

      return mock;
    };

    mockDb = createChainableMock();

    mockDraftVersionService = {
      createVersion: vi.fn().mockResolvedValue({}),
      deleteAllVersions: vi.fn().mockResolvedValue(undefined),
    };

    mockPipelineService = {
      dispatchEvent: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        DraftService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: DraftVersionService,
          useValue: mockDraftVersionService,
        },
        {
          provide: PipelineService,
          useValue: mockPipelineService,
        },
      ],
    }).compile();

    service = module.get<DraftService>(DraftService);
  });

  describe('findAll', () => {
    it('should return drafts with pagination', async () => {
      const mockDrafts = [
        {
          id: 1,
          title: 'Test Draft',
          content: 'Test content',
          tags: JSON.stringify(['test']),
          author: 'admin',
          pathname: null,
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Setup for Promise.all - both queries run simultaneously
      mockDb.offset.mockResolvedValueOnce(mockDrafts);
      // Second where call (for count query) resolves with count
      let whereCallCount = 0;
      mockDb.where.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 2) {
          // This is the count query
          return Promise.resolve([{ count: 1 }]);
        }
        return mockDb;
      });

      const result = await service.findAll({
        page: 1,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('findOne', () => {
    it('should return a single draft', async () => {
      const mockDraft = {
        id: 1,
        title: 'Test Draft',
        content: 'Test content',
        tags: JSON.stringify(['test']),
        author: 'admin',
        pathname: null,
        category: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockDraft]);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Draft');
    });

    it('should throw NotFoundException when draft not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new draft', async () => {
      const mockCreatedDraft = {
        id: 1,
        title: 'New Draft',
        content: 'New content',
        tags: JSON.stringify(['new']),
        author: 'admin',
        pathname: null,
        category: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedDraft]);

      const createDto = {
        title: 'New Draft',
        content: 'New content',
        tags: ['new'],
        categories: ['test-category'],
      };

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.title).toBe('New Draft');
      expect(result.tags).toEqual(['new']);
    });
  });

  describe('update', () => {
    it('should update an existing draft', async () => {
      const mockUpdatedDraft = {
        id: 1,
        title: 'Updated Draft',
        content: 'Updated content',
        tags: JSON.stringify(['updated']),
        author: 'admin',
        pathname: null,
        category: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock for draft update only
      mockDb.returning.mockResolvedValueOnce([mockUpdatedDraft]);

      const updateDto = {
        title: 'Updated Draft',
        content: 'Updated content',
        tags: ['updated'],
      };

      const result = await service.update(1, updateDto);

      expect(result.title).toBe('Updated Draft');
      expect(result.tags).toEqual(['updated']);
      expect(mockDraftVersionService.createVersion).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when draft not found', async () => {
      // Mock version creation to throw NotFoundException
      mockDraftVersionService.createVersion = vi
        .fn()
        .mockRejectedValue(new NotFoundException('Draft with ID 999 not found'));

      await expect(service.update(999, { title: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a draft', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when draft not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish', () => {
    it.skip('should publish a draft as an article', async () => {
      // Reset all mocks to ensure clean state
      vi.clearAllMocks();
      const mockDraftRaw = {
        id: 1,
        title: 'Draft to Publish',
        content: 'Content to publish',
        tags: JSON.stringify(['publish', 'test']),
        author: 'admin',
        pathname: 'draft-to-publish',
        category: 'test-category',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // The draft object returned by findOne will have tags parsed
      // const mockDraft = {
      //   ...mockDraftRaw,
      //   tags: ['publish', 'test'],
      // };

      const mockArticle = {
        id: 100,
        title: 'Draft to Publish',
        content: 'Content to publish',
        tags: JSON.stringify(['publish', 'test']),
        author: 'admin',
        pathname: 'draft-to-publish',
        category: 'test-category',
        top: 0,
        hidden: false,
        private: false,
        password: null,
        viewer: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findOne to return the draft
      let limitCallCount = 0;
      mockDb.limit.mockImplementation(() => {
        limitCallCount++;
        if (limitCallCount === 1) {
          return Promise.resolve([mockDraftRaw]); // Return raw draft with JSON tags
        }
        return mockDb;
      });

      // Mock tag check - select existing tags
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 2) {
          // This is for tag check - use default chaining
          return mockDb;
        }
        return mockDb;
      });

      // Mock from to return empty array for tag check
      let fromCallCount = 0;
      mockDb.from.mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 2) {
          // This is for tag check - return empty array (no existing tags)
          return Promise.resolve([]);
        }
        return mockDb;
      });

      // Mock tag creation
      mockDb.values.mockImplementation(() => {
        return mockDb;
      });
      let returningCallCount = 0;
      mockDb.returning.mockImplementation(() => {
        returningCallCount++;
        if (returningCallCount === 1) {
          // Tag creation
          return Promise.resolve([
            { id: 1, name: 'publish', slug: 'publish' },
            { id: 2, name: 'test', slug: 'test' },
          ]);
        } else if (returningCallCount === 2) {
          // Article creation with ID 100
          return Promise.resolve([{ ...mockArticle, id: 100 }]);
        } else if (returningCallCount === 3) {
          return Promise.resolve([{ id: 1 }]); // Draft deletion
        }
        return Promise.resolve([]);
      });

      const publishDto = {
        isPublished: true,
        isTop: false,
        allowComment: true,
      };

      const result = await service.publish(1, publishDto);

      expect(result).toBeDefined();
      expect(result.title).toBe('Draft to Publish');
      expect(result.tags).toEqual(['publish', 'test']);
      expect(result.top).toBe(0);
      expect(result.hidden).toBe(false);
      expect(result.private).toBe(false);
    });
  });

  describe('importDrafts', () => {
    it('should import multiple drafts', async () => {
      const draftsToImport = [
        {
          title: 'Import 1',
          content: 'Content 1',
          tags: ['import'],
          categories: ['test'],
        },
        {
          title: 'Import 2',
          content: 'Content 2',
          tags: [],
          categories: ['imported'],
        },
      ];

      const mockResults = draftsToImport.map((draft, index) => ({
        id: index + 1,
        ...draft,
        tags: JSON.stringify(draft.tags),
        category: null,
        author: 'admin',
        pathname: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockDb.values
        .mockReturnValueOnce(mockDb) // First draft
        .mockReturnValueOnce(mockDb); // Second draft

      mockDb.returning
        .mockResolvedValueOnce([mockResults[0]]) // First draft
        .mockResolvedValueOnce([mockResults[1]]); // Second draft

      await service.importDrafts(draftsToImport);

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(mockDb.values).toHaveBeenCalledTimes(2);
    });
  });

  describe('autoSave', () => {
    it('should auto-save a draft', async () => {
      const mockUpdatedDraft = {
        id: 1,
        title: 'Auto-saved Draft',
        content: 'Auto-saved content',
        tags: JSON.stringify(['auto-save']),
        author: 'admin',
        pathname: null,
        category: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockUpdatedDraft]);

      const updateDto = {
        title: 'Auto-saved Draft',
        content: 'Auto-saved content',
      };

      const result = await service.autoSave(1, updateDto);

      expect(result.title).toBe('Auto-saved Draft');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
