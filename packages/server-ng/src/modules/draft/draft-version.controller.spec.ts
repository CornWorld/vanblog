import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { Mock } from '@test/mock';
import { createMockDraft } from '@test/fixtures/test-data';
import { DraftVersionService } from './draft-version.service';
import { DraftVersionTsRestController } from './draft-version.controller';

describe('DraftVersionTsRestController', () => {
  let controller: DraftVersionTsRestController;
  let mockDraftVersionService: any;

  beforeEach(async () => {
    mockDraftVersionService = Mock.draftVersionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DraftVersionTsRestController],
      providers: [{ provide: DraftVersionService, useValue: mockDraftVersionService }],
    }).compile();

    controller = module.get<DraftVersionTsRestController>(DraftVersionTsRestController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listVersions', () => {
    it('should return list of versions', async () => {
      const mockDraft = createMockDraft();
      const mockVersions = [
        {
          id: 1,
          draftId: mockDraft.id,
          version: 2,
          title: 'Version 2',
          content: 'Content 2',
          pathname: null,
          tags: ['v2'],
          category: null,
          author: 'admin',
          createdAt: '2023-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          draftId: mockDraft.id,
          version: 1,
          title: 'Version 1',
          content: 'Content 1',
          pathname: null,
          tags: null,
          category: null,
          author: 'admin',
          createdAt: '2023-01-01T00:00:00.000Z',
        },
      ];

      mockDraftVersionService.getVersions.mockResolvedValue(mockVersions);

      const result = await controller.listVersions(mockDraft.id);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(mockDraftVersionService.getVersions).toHaveBeenCalledWith(mockDraft.id);
    });

    it('should handle custom page and pageSize', async () => {
      const mockDraft = createMockDraft();
      mockDraftVersionService.getVersions.mockResolvedValue([]);

      const result = await controller.listVersions(mockDraft.id, 2, 5);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
    });

    it('should handle service errors gracefully', async () => {
      mockDraftVersionService.getVersions.mockRejectedValue(new Error('Service error'));

      const result = await controller.listVersions(createMockDraft().id);

      // Should return default empty response, not throw
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(0);
    });
  });

  describe('getVersion', () => {
    it('should return a specific version', async () => {
      const mockDraft = createMockDraft();
      const mockVersion = {
        id: 1,
        draftId: mockDraft.id,
        version: 2,
        title: 'Version 2',
        content: 'Content 2',
        pathname: null,
        tags: ['v2'],
        category: null,
        author: 'admin',
        createdAt: '2023-01-01T00:00:00.000Z',
      };

      mockDraftVersionService.getVersion.mockResolvedValue(mockVersion);

      const result = await controller.getVersion(mockDraft.id, 2);

      expect(result.version).toBe(2);
      expect(result.title).toBe('Version 2');
      expect(mockDraftVersionService.getVersion).toHaveBeenCalledWith(mockDraft.id, 2);
    });

    it('should handle service errors gracefully', async () => {
      mockDraftVersionService.getVersion.mockRejectedValue(new Error('Version not found'));

      const result = await controller.getVersion(createMockDraft().id, 999);

      // Should return default empty response, not throw
      expect(result.id).toBe(0);
      expect(result.version).toBe(0);
    });
  });

  describe('createVersion', () => {
    it('should create a new version', async () => {
      const mockDraft = createMockDraft();
      const mockNewVersion = {
        id: 3,
        draftId: mockDraft.id,
        version: 3,
        title: 'Version 3',
        content: 'Content 3',
        pathname: null,
        tags: null,
        category: null,
        author: 'admin',
        createdAt: '2023-01-01T00:00:00.000Z',
      };

      mockDraftVersionService.createVersion.mockResolvedValue(mockNewVersion);

      const result = await controller.createVersion(mockDraft.id);

      expect(result.version).toBe(3);
      expect(mockDraftVersionService.createVersion).toHaveBeenCalledWith(mockDraft.id);
    });

    it('should handle service errors gracefully', async () => {
      mockDraftVersionService.createVersion.mockRejectedValue(new Error('Creation failed'));

      const result = await controller.createVersion(createMockDraft().id);

      // Should return default empty response, not throw
      expect(result.id).toBe(0);
      expect(result.version).toBe(0);
    });
  });

  describe('deleteVersion', () => {
    it('should delete a version', async () => {
      const mockDraft = createMockDraft();
      mockDraftVersionService.deleteVersion.mockResolvedValue(undefined);

      const result = await controller.deleteVersion(mockDraft.id, 2);

      expect(result.success).toBe(true);
      expect(mockDraftVersionService.deleteVersion).toHaveBeenCalledWith(mockDraft.id, 2);
    });

    it('should handle service errors gracefully', async () => {
      const mockDraft = createMockDraft();
      mockDraftVersionService.deleteVersion.mockRejectedValue(new Error('Deletion failed'));

      const result = await controller.deleteVersion(mockDraft.id, 2);

      expect(result.success).toBe(false);
    });
  });

  describe('mapToDraftVersion', () => {
    it('should map to DraftVersion with null tags', () => {
      const input = {
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Test',
        content: 'Content',
        pathname: null,
        tags: null,
        category: null,
        author: 'admin',
        createdAt: '2023-01-01T00:00:00.000Z',
      };

      const result = controller['mapToDraftVersion'](input);

      expect(result.tags).toBeNull();
      expect(result.title).toBe('Test');
    });

    it('should map to DraftVersion with array tags', () => {
      const input = {
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Test',
        content: 'Content',
        pathname: null,
        tags: ['tag1', 'tag2'],
        category: null,
        author: 'admin',
        createdAt: '2023-01-01T00:00:00.000Z',
      };

      const result = controller['mapToDraftVersion'](input);

      expect(result.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle missing/null fields with defaults', () => {
      const input = {
        id: 1,
        draftId: 1,
        version: 1,
        title: null,
        content: null,
        pathname: null,
        tags: null,
        category: null,
        author: null,
        createdAt: null,
      };

      const result = controller['mapToDraftVersion'](input);

      expect(result.title).toBe('');
      expect(result.content).toBe('');
      expect(result.author).toBe('');
      expect(result.createdAt).toBeTruthy();
    });
  });
});
