import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { Mock } from '@test/mock';
import { DraftVersionService } from './draft-version.service';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';
import { Article } from '../article/entities/article.entity';

describe('DraftController', () => {
  let controller: DraftController;
  let mockDraftService: any;
  let mockDraftVersionService: any;

  beforeEach(async () => {
    // ✅ 优化：使用新的扁平化 Mock API
    mockDraftService = Mock.draftService();
    mockDraftVersionService = Mock.draftVersionService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DraftController],
      providers: [
        { provide: DraftService, useValue: mockDraftService },
        { provide: DraftVersionService, useValue: mockDraftVersionService },
      ],
    }).compile();

    controller = module.get<DraftController>(DraftController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================
  // Standard NestJS Methods
  // ============================================

  describe('findAll', () => {
    it('should pass query with defaults and return list', async () => {
      const query = { page: 1, pageSize: 10 };
      const list = { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
      mockDraftService.findAll.mockResolvedValue(list);

      const result = await controller.findAll(query);

      // Schema adds sortBy and sortOrder defaults
      expect(mockDraftService.findAll).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      expect(result).toBe(list);
    });

    it('should support filtering by keyword', async () => {
      const list = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockDraftService.findAll.mockResolvedValue(list);

      await controller.findAll({ keyword: 'test', page: 1, pageSize: 10 });

      expect(mockDraftService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: 'test',
        }),
      );
    });

    it('should support filtering by category', async () => {
      const list = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockDraftService.findAll.mockResolvedValue(list);

      await controller.findAll({ category: 'tech', page: 1, pageSize: 10 });

      expect(mockDraftService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'tech',
        }),
      );
    });

    it('should support filtering by tag', async () => {
      const list = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockDraftService.findAll.mockResolvedValue(list);

      await controller.findAll({ tag: 'javascript', page: 1, pageSize: 10 });

      expect(mockDraftService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: 'javascript',
        }),
      );
    });

    it('should support custom sortBy and sortOrder', async () => {
      const list = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockDraftService.findAll.mockResolvedValue(list);

      await controller.findAll({ page: 1, pageSize: 10, sortBy: 'title', sortOrder: 'asc' });

      expect(mockDraftService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'title',
          sortOrder: 'asc',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should pass id as string', async () => {
      const item = { id: 1, title: 'Test Draft' };
      mockDraftService.findOne.mockResolvedValue(item);

      const result = await controller.findOne('1');

      expect(mockDraftService.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe(item);
    });
  });

  describe('create', () => {
    it('should pass dto with required fields', async () => {
      const dto = { title: 't', content: 'content', author: 'admin', tags: null };
      const created = { id: 1, ...dto };
      mockDraftService.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(mockDraftService.create).toHaveBeenCalled();
      expect(result).toBe(created);
    });

    it('should handle dto with tags', async () => {
      const dto = { title: 't', content: 'content', author: 'admin', tags: ['tag1', 'tag2'] };
      const created = { id: 1, ...dto };
      mockDraftService.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(mockDraftService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['tag1', 'tag2'],
        }),
      );
      expect(result).toBe(created);
    });

    it('should handle dto with category', async () => {
      const dto = { title: 't', content: 'content', author: 'admin', category: 'tech', tags: null };
      const created = { id: 1, ...dto };
      mockDraftService.create.mockResolvedValue(created);

      await controller.create(dto);

      expect(mockDraftService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'tech',
        }),
      );
    });
  });

  describe('update', () => {
    it('should pass id as string and dto', async () => {
      const dto = { title: 'u' };
      const updated = { id: 1, title: 'u' };
      mockDraftService.update.mockResolvedValue(updated);

      const result = await controller.update('1', dto);

      expect(mockDraftService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'u' }),
      );
      expect(result).toBe(updated);
    });

    it('should handle partial updates', async () => {
      const dto = { content: 'new content' };
      const updated = { id: 1, content: 'new content' };
      mockDraftService.update.mockResolvedValue(updated);

      await controller.update('1', dto);

      expect(mockDraftService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ content: 'new content' }),
      );
    });

    it('should handle tag updates', async () => {
      const dto = { tags: ['new', 'tags'] };
      const updated = { id: 1, tags: ['new', 'tags'] };
      mockDraftService.update.mockResolvedValue(updated);

      await controller.update('1', dto);

      expect(mockDraftService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ tags: ['new', 'tags'] }),
      );
    });
  });

  describe('remove', () => {
    it('should pass id as string', async () => {
      mockDraftService.remove.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(mockDraftService.remove).toHaveBeenCalledWith(1);
    });
  });

  describe('publish', () => {
    it('should pass id and publishDto with defaults', async () => {
      const publishDto = {};
      const article = new Article({ id: 99, title: 'Published Article' });
      mockDraftService.publish.mockResolvedValue(article);

      const result = await controller.publish(1, publishDto);

      // Schema adds defaults for isPublished, isTop, allowComment
      expect(mockDraftService.publish).toHaveBeenCalledWith(1, {
        isPublished: true,
        isTop: false,
        allowComment: true,
      });
      expect(result).toBe(article);
    });

    it('should handle custom publish options', async () => {
      const publishDto = {
        isTop: true,
        password: 'secret',
        allowComment: false,
      };
      const article = new Article({ id: 99, title: 'Published Article' });
      mockDraftService.publish.mockResolvedValue(article);

      await controller.publish(1, publishDto);

      expect(mockDraftService.publish).toHaveBeenCalledWith(1, {
        isPublished: true,
        isTop: true,
        password: 'secret',
        allowComment: false,
      });
    });
  });

  describe('importDrafts', () => {
    it('should pass array with required fields', async () => {
      const drafts = [{ title: 'a', content: 'content', author: 'admin', tags: null }];
      mockDraftService.importDrafts.mockResolvedValue(undefined);

      await controller.importDrafts(drafts);

      expect(mockDraftService.importDrafts).toHaveBeenCalled();
    });

    it('should handle multiple drafts', async () => {
      const drafts = [
        { title: 'Draft 1', content: 'content 1', author: 'admin', tags: null },
        { title: 'Draft 2', content: 'content 2', author: 'admin', tags: null },
        { title: 'Draft 3', content: 'content 3', author: 'admin', tags: null },
      ];
      mockDraftService.importDrafts.mockResolvedValue(undefined);

      await controller.importDrafts(drafts);

      expect(mockDraftService.importDrafts).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Draft 1' }),
          expect.objectContaining({ title: 'Draft 2' }),
          expect.objectContaining({ title: 'Draft 3' }),
        ]),
      );
    });
  });

  describe('autoSave', () => {
    it('should pass id and dto', async () => {
      const dto = { content: 'x' };
      const saved = { id: 1, content: 'x' };
      mockDraftService.autoSave.mockResolvedValue(saved);

      const result = await controller.autoSave(1, dto);

      expect(mockDraftService.autoSave).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ content: 'x' }),
      );
      expect(result).toBe(saved);
    });

    it('should handle multiple fields in autoSave', async () => {
      const dto = { title: 'AutoSaved', content: 'AutoSaved content', tags: ['auto'] };
      const saved = { id: 1, ...dto };
      mockDraftService.autoSave.mockResolvedValue(saved);

      await controller.autoSave(1, dto);

      expect(mockDraftService.autoSave).toHaveBeenCalledWith(1, expect.objectContaining(dto));
    });
  });

  describe('getVersions', () => {
    it('should return wrapped pagination structure', async () => {
      const versions = [{ v: 1 }, { v: 2 }];
      mockDraftVersionService.getVersions.mockResolvedValue(versions);

      const result = await controller.getVersions(1);

      expect(mockDraftVersionService.getVersions).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        items: versions,
        total: versions.length,
        page: 1,
        pageSize: versions.length,
        totalPages: 1,
      });
    });

    it('should handle empty versions', async () => {
      const versions: unknown[] = [];
      mockDraftVersionService.getVersions.mockResolvedValue(versions);

      const result = await controller.getVersions(1);

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 0,
        totalPages: 1,
      });
    });
  });

  describe('getVersion', () => {
    it('should pass id and version', async () => {
      const version = { id: 1, v: 2 };
      mockDraftVersionService.getVersion.mockResolvedValue(version);

      const result = await controller.getVersion(1, 2);

      expect(mockDraftVersionService.getVersion).toHaveBeenCalledWith(1, 2);
      expect(result).toBe(version);
    });
  });

  describe('restoreVersion', () => {
    it('should pass id and version', async () => {
      mockDraftVersionService.restoreVersion.mockResolvedValue(undefined);

      await controller.restoreVersion(1, 2);

      expect(mockDraftVersionService.restoreVersion).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('deleteVersion', () => {
    it('should pass id and version', async () => {
      mockDraftVersionService.deleteVersion.mockResolvedValue(undefined);

      await controller.deleteVersion(1, 2);

      expect(mockDraftVersionService.deleteVersion).toHaveBeenCalledWith(1, 2);
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty draft list', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockDraftService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll({ page: 1, pageSize: 10 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle large page numbers', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 999,
        pageSize: 10,
        totalPages: 0,
      };
      mockDraftService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll({ page: 999, pageSize: 10 });

      expect(result.page).toBe(999);
    });

    it('should handle drafts with empty tags array', async () => {
      const mockDraft = {
        id: 1,
        title: 'Test',
        content: 'Content',
        tags: [],
      };
      mockDraftService.findOne.mockResolvedValue(mockDraft);

      const result = await controller.findOne('1');

      expect(result.tags).toEqual([]);
    });

    it('should handle special characters in draft title', async () => {
      const dto = {
        title: 'Special chars: @#$%^&*()',
        content: 'Content',
        author: 'admin',
        tags: null,
      };
      const created = { id: 1, ...dto };
      mockDraftService.create.mockResolvedValue(created);

      await controller.create(dto);

      expect(mockDraftService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Special chars: @#$%^&*()',
        }),
      );
    });

    it('should handle very long content', async () => {
      const longContent = 'a'.repeat(10000);
      const dto = {
        title: 'Long content',
        content: longContent,
        author: 'admin',
        tags: null,
      };
      const created = { id: 1, ...dto };
      mockDraftService.create.mockResolvedValue(created);

      await controller.create(dto);

      expect(mockDraftService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: longContent,
        }),
      );
    });

    it('should handle empty version list', async () => {
      mockDraftVersionService.getVersions.mockResolvedValue([]);

      const result = await controller.getVersions(1);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
    });
  });

  // ============================================
  // Schema Validation Tests
  // ============================================

  describe('Schema Validation', () => {
    it('should validate findAll query parameters', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockDraftService.findAll.mockResolvedValue(mockResult);

      // Valid query
      await expect(
        controller.findAll({ page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
      ).resolves.toBeDefined();

      // Invalid query should throw
      await expect(controller.findAll({ page: -1 })).rejects.toThrow();
    });

    it('should validate create draft DTO', async () => {
      const mockDraft = {
        id: 1,
        title: 'Test',
        content: 'Content',
        author: 'admin',
        tags: null,
      };
      mockDraftService.create.mockResolvedValue(mockDraft);

      // Valid DTO
      await expect(
        controller.create({ title: 'Test', content: 'Content', author: 'admin', tags: null }),
      ).resolves.toBeDefined();

      // Invalid DTO - missing required fields
      await expect(controller.create({ title: 'Test' })).rejects.toThrow();
    });

    it('should validate update draft DTO', async () => {
      const mockDraft = { id: 1, title: 'Updated' };
      mockDraftService.update.mockResolvedValue(mockDraft);

      // Valid update
      await expect(controller.update('1', { title: 'Updated' })).resolves.toBeDefined();

      // Empty update is valid (partial update)
      await expect(controller.update('1', {})).resolves.toBeDefined();
    });

    it('should validate publish DTO', async () => {
      const mockArticle = new Article({ id: 99, title: 'Published' });
      mockDraftService.publish.mockResolvedValue(mockArticle);

      // Valid publish with defaults
      await expect(controller.publish(1, {})).resolves.toBeDefined();

      // Valid publish with options
      await expect(
        controller.publish(1, { isTop: true, password: 'secret' }),
      ).resolves.toBeDefined();
    });

    it('should validate importDrafts array', async () => {
      mockDraftService.importDrafts.mockResolvedValue(undefined);

      // Valid array
      await expect(
        controller.importDrafts([
          { title: 'Draft 1', content: 'Content 1', author: 'admin', tags: null },
          { title: 'Draft 2', content: 'Content 2', author: 'admin', tags: null },
        ]),
      ).resolves.toBeUndefined();

      // Invalid - not an array
      await expect(controller.importDrafts({ title: 'Test' })).rejects.toThrow();
    });
  });
});
