import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { DATABASE_CONNECTION } from '../../database/database.module';
import { HookService } from '../plugin/services/hook.service';

import { DraftVersionService } from './draft-version.service';
import { DraftService } from './draft.service';

describe('DraftService', () => {
  let service: DraftService;
  let mockDraftVersionService: Partial<DraftVersionService>;

  let mockHookService: Partial<HookService>;
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    // Create chainable mock object
    const createChainableMock = (): Record<string, ReturnType<typeof vi.fn>> => {
      const mock: Record<string, ReturnType<typeof vi.fn>> = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      };

      return mock;
    };

    mockDb = createChainableMock();

    mockDraftVersionService = {
      createVersion: vi.fn().mockResolvedValue({}),
      deleteAllVersions: vi.fn().mockResolvedValue(undefined),
    };

    mockHookService = {
      applyFilters: vi.fn().mockImplementation(async (_, data) => Promise.resolve(data)),
      doAction: vi.fn().mockResolvedValue(undefined),
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
          provide: HookService,
          useValue: mockHookService,
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
          // This is the count query - return a mock that resolves to count
          return {
            ...mockDb,
            then: (resolve: any) => resolve([{ count: 1 }]),
          };
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
        author: 'test-author',
        tags: JSON.stringify(['new']),
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
        tags: JSON.stringify(['updated']),
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

      await expect(
        service.update(999, { title: 'Test', tags: JSON.stringify([]) }),
      ).rejects.toThrow(NotFoundException);
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
    it('should publish a draft as an article', async () => {
      // Reset all mocks to ensure clean state
      // vi.clearAllMocks(); // Removing this to keep chainable mocks intact
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
      mockDb.limit.mockImplementation(async () => {
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
      mockDb.from.mockImplementation((_table?: unknown) => {
        fromCallCount++;
        if (fromCallCount === 2) {
          // This is for tag check - return thenable resolving to empty array
          return {
            ...mockDb,
            then: (resolve: (val: unknown[]) => unknown) => resolve([]),
          } as unknown as typeof mockDb;
        }
        // Default: keep chainable behavior
        return mockDb;
      });

      // Mock tag creation
      mockDb.values.mockImplementation(() => {
        return mockDb;
      });
      let returningCallCount = 0;
      mockDb.returning.mockImplementation(async () => {
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

    it('should set private=true and hash password when provided', async () => {
      const mockDraftRaw = {
        id: 2,
        title: 'Secret Draft',
        content: 'Top secret content',
        tags: JSON.stringify(['secret', 'tag']),
        author: 'admin',
        pathname: 'secret-draft',
        category: 'test-category',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // findOne
      mockDb.limit.mockResolvedValueOnce([mockDraftRaw]);

      // createMissingTags -> select/from -> [] means all tags missing
      let fromCallCount2 = 0;
      mockDb.from.mockImplementation((_table?: unknown) => {
        fromCallCount2++;
        if (fromCallCount2 === 2) {
          return {
            ...mockDb,
            then: (resolve: (val: unknown[]) => unknown) => resolve([]),
          } as unknown as typeof mockDb;
        }
        return mockDb;
      });

      let valuesCallCount = 0;
      let capturedArticleValues: any;
      mockDb.values.mockImplementation((vals?: any) => {
        valuesCallCount++;
        if (valuesCallCount === 2) {
          capturedArticleValues = vals; // The second values() corresponds to articles insertion
        }
        return mockDb;
      });

      let returningCallCount2 = 0;
      mockDb.returning.mockImplementation(async () => {
        returningCallCount2++;
        if (returningCallCount2 === 1) {
          // tag creation returning
          return Promise.resolve([
            { id: 10, name: 'secret', slug: 'secret' },
            { id: 11, name: 'tag', slug: 'tag' },
          ]);
        }
        if (returningCallCount2 === 2) {
          // article creation returning
          // it doesn't matter what password here is; we assert capturedArticleValues
          return Promise.resolve([
            {
              id: 200,
              title: 'Secret Draft',
              content: 'Top secret content',
              tags: JSON.stringify(['secret', 'tag']),
              author: 'admin',
              pathname: 'secret-draft',
              category: 'test-category',
              top: 1,
              hidden: false,
              private: true,
              password: 'placeholder',
              viewer: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]);
        }
        if (returningCallCount2 === 3) {
          // draft deletion returning
          return Promise.resolve([{ id: 2 }]);
        }
        return Promise.resolve([]);
      });

      const publishDto = {
        isPublished: true,
        isTop: true,
        allowComment: true,
        password: 's3cr3t',
      } as any;

      const result = await service.publish(2, publishDto);

      expect(result).toBeDefined();
      expect(result.private).toBe(true);
      expect(result.top).toBe(1);

      expect(capturedArticleValues).toBeDefined();
      expect(Array.isArray(capturedArticleValues)).toBe(true);
      const [inserted] = capturedArticleValues;
      expect(inserted.private).toBe(true);
      expect(typeof inserted.password).toBe('string');
      expect(inserted.password).not.toBe(publishDto.password);
      const ok = await bcrypt.compare(publishDto.password, inserted.password);
      expect(ok).toBe(true);
    });

    it('should throw when article creation returns empty array', async () => {
      const mockDraftRaw = {
        id: 3,
        title: 'Draft Fail',
        content: 'Will fail to publish',
        tags: JSON.stringify([]), // no tags -> createMissingTags will not insert
        author: 'admin',
        pathname: 'draft-fail',
        category: 'none',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // findOne
      mockDb.limit.mockResolvedValueOnce([mockDraftRaw]);

      // returning for article creation -> []
      mockDb.returning.mockResolvedValueOnce([]);

      const publishDto = {
        isPublished: true,
        isTop: false,
        allowComment: true,
      } as any;

      await expect(service.publish(3, publishDto)).rejects.toThrow('Failed to publish draft');
    });
  });

  describe('importDrafts', () => {
    it('should import multiple drafts', async () => {
      const draftsToImport = [
        {
          title: 'Import 1',
          content: 'Content 1',
          tags: JSON.stringify(['import']),
          categories: ['test'],
          author: 'test-author',
        },
        {
          title: 'Import 2',
          content: 'Content 2',
          tags: JSON.stringify([]),
          categories: ['imported'],
          author: 'test-author',
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
        tags: JSON.stringify([]),
      };

      const result = await service.autoSave(1, updateDto);

      expect(result.title).toBe('Auto-saved Draft');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
