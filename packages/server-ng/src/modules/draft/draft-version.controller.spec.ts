import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { Mock } from '@test/mock';
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
      const mockVersions = [
        {
          id: 1,
          draftId: 1,
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
          draftId: 1,
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

      const handler = controller.listVersions();
      const result = await handler({ params: { id: '1' }, query: {} });

      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(2);
      expect(result.body.total).toBe(2);
      expect(result.body.page).toBe(1);
      expect(mockDraftVersionService.getVersions).toHaveBeenCalledWith(1);
    });

    it('should handle custom page and pageSize', async () => {
      mockDraftVersionService.getVersions.mockResolvedValue([]);

      const handler = controller.listVersions();
      const result = await handler({ params: { id: '1' }, query: { page: 2, pageSize: 5 } });

      expect(result.status).toBe(200);
      expect(result.body.page).toBe(2);
      expect(result.body.pageSize).toBe(5);
    });

    it('should handle service errors gracefully', async () => {
      mockDraftVersionService.getVersions.mockRejectedValue(new Error('Service error'));

      const handler = controller.listVersions();
      const result = await handler({ params: { id: '1' }, query: {} });

      // Should return default empty response, not throw
      expect(result.status).toBe(200);
      expect(result.body.items).toEqual([]);
      expect(result.body.total).toBe(0);
      expect(result.body.page).toBe(1);
      expect(result.body.pageSize).toBe(0);
    });
  });

  describe('getVersion', () => {
    it('should return a specific version', async () => {
      const mockVersion = {
        id: 1,
        draftId: 1,
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

      const handler = controller.getVersion();
      const result = await handler({ params: { id: '1', versionId: '2' } });

      expect(result.status).toBe(200);
      expect(result.body.version).toBe(2);
      expect(result.body.title).toBe('Version 2');
      expect(mockDraftVersionService.getVersion).toHaveBeenCalledWith(1, 2);
    });

    it('should handle service errors gracefully', async () => {
      mockDraftVersionService.getVersion.mockRejectedValue(new Error('Version not found'));

      const handler = controller.getVersion();
      const result = await handler({ params: { id: '1', versionId: '999' } });

      // Should return default empty response, not throw
      expect(result.status).toBe(200);
      expect(result.body.id).toBe(0);
      expect(result.body.version).toBe(0);
    });
  });

  describe('createVersion', () => {
    it('should create a new version', async () => {
      const mockNewVersion = {
        id: 3,
        draftId: 1,
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

      const handler = controller.createVersion();
      const result = await handler({ params: { id: '1' } });

      expect(result.status).toBe(201);
      expect(result.body.version).toBe(3);
      expect(mockDraftVersionService.createVersion).toHaveBeenCalledWith(1);
    });

    it('should handle service errors gracefully', async () => {
      mockDraftVersionService.createVersion.mockRejectedValue(new Error('Creation failed'));

      const handler = controller.createVersion();
      const result = await handler({ params: { id: '1' } });

      // Should return default empty response, not throw
      expect(result.status).toBe(201);
      expect(result.body.id).toBe(0);
      expect(result.body.version).toBe(0);
    });
  });

  describe('deleteVersion', () => {
    it('should delete a version', async () => {
      mockDraftVersionService.deleteVersion.mockResolvedValue(undefined);

      const handler = controller.deleteVersion();
      const result = await handler({ params: { id: '1', versionId: '2' } });

      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
      expect(mockDraftVersionService.deleteVersion).toHaveBeenCalledWith(1, 2);
    });

    it('should handle service errors gracefully', async () => {
      mockDraftVersionService.deleteVersion.mockRejectedValue(new Error('Deletion failed'));

      const handler = controller.deleteVersion();
      const result = await handler({ params: { id: '1', versionId: '2' } });

      expect(result.status).toBe(200);
      expect(result.body.success).toBe(false);
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
