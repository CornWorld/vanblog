import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { dayjs } from '@vanblog/shared';

import { MockUtils } from '../../../test/mock-utils';

import { DraftVersionService } from './draft-version.service';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';
import { Article } from '../article/entities/article.entity';

const mockDraftService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  publish: vi.fn(),
  importDrafts: vi.fn(),
  autoSave: vi.fn(),
};

const mockDraftVersionService = {
  getVersions: vi.fn(),
  getVersion: vi.fn(),
  restoreVersion: vi.fn(),
  deleteVersion: vi.fn(),
};

describe('DraftController', () => {
  let controller: DraftController;

  beforeEach(async () => {
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
  // Legacy API Methods (non-ts-rest)
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
    it('should pass id', async () => {
      const item = { id: 1, title: 'Test Draft' };
      mockDraftService.findOne.mockResolvedValue(item);

      const result = await controller.findOne(1);

      expect(mockDraftService.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe(item);
    });
  });

  describe('create', () => {
    it('should pass dto with required fields', async () => {
      const dto = { title: 't', content: 'content', author: 'admin' };
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
      const dto = { title: 't', content: 'content', author: 'admin', category: 'tech' };
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
    it('should pass id and dto', async () => {
      const dto = { title: 'u' };
      const updated = { id: 1, title: 'u' };
      mockDraftService.update.mockResolvedValue(updated);

      const result = await controller.update(1, dto);

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

      await controller.update(1, dto);

      expect(mockDraftService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ content: 'new content' }),
      );
    });

    it('should handle tag updates', async () => {
      const dto = { tags: ['new', 'tags'] };
      const updated = { id: 1, tags: ['new', 'tags'] };
      mockDraftService.update.mockResolvedValue(updated);

      await controller.update(1, dto);

      expect(mockDraftService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ tags: ['new', 'tags'] }),
      );
    });
  });

  describe('remove', () => {
    it('should pass id', async () => {
      mockDraftService.remove.mockResolvedValue(undefined);

      await controller.remove(1);

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
      const drafts = [{ title: 'a', content: 'content', author: 'admin' }];
      mockDraftService.importDrafts.mockResolvedValue(undefined);

      await controller.importDrafts(drafts);

      expect(mockDraftService.importDrafts).toHaveBeenCalled();
    });

    it('should handle multiple drafts', async () => {
      const drafts = [
        { title: 'Draft 1', content: 'content 1', author: 'admin' },
        { title: 'Draft 2', content: 'content 2', author: 'admin' },
        { title: 'Draft 3', content: 'content 3', author: 'admin' },
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
      const versions = [];
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
  // ts-rest Handler Tests
  // ============================================

  describe('getDrafts (ts-rest)', () => {
    it('should return paginated drafts', async () => {
      const mockDraft = {
        id: 1,
        title: 'Test Draft',
        content: 'Test content',
        category: 'tech',
        tags: ['test', 'draft'],
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      const mockResult = {
        items: [mockDraft],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockDraftService.findAll.mockResolvedValue(mockResult);

      const handler = controller.getDrafts();
      const result = await handler({ query: { page: 1, pageSize: 10 } });

      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(1);
      expect(result.body.items[0].id).toBe(1);
      expect(result.body.items[0].title).toBe('Test Draft');
      expect(result.body.items[0].category).toBe('tech');
      expect(result.body.items[0].tags).toEqual(['test', 'draft']);
      expect(mockDraftService.findAll).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        category: undefined,
        tag: undefined,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
    });

    it('should handle category filter', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockDraftService.findAll.mockResolvedValue(mockResult);

      const handler = controller.getDrafts();
      await handler({ query: { page: 1, pageSize: 10, category: 'tech' } });

      expect(mockDraftService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'tech',
        }),
      );
    });

    it('should handle tag filter', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      mockDraftService.findAll.mockResolvedValue(mockResult);

      const handler = controller.getDrafts();
      await handler({ query: { page: 1, pageSize: 10, tag: 'javascript' } });

      expect(mockDraftService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: 'javascript',
        }),
      );
    });

    it('should handle null category and tags', async () => {
      const mockDraft = {
        id: 1,
        title: 'Test Draft',
        content: 'Test content',
        category: null,
        tags: null,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      const mockResult = {
        items: [mockDraft],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockDraftService.findAll.mockResolvedValue(mockResult);

      const handler = controller.getDrafts();
      const result = await handler({ query: { page: 1, pageSize: 10 } });

      expect(result.body.items[0].category).toBeUndefined();
      expect(result.body.items[0].tags).toBeUndefined();
    });
  });

  describe('createDraft (ts-rest)', () => {
    it('should create draft with required fields', async () => {
      const createDto = {
        title: 'New Draft',
        content: 'New content',
      };
      const mockDraft = {
        id: 1,
        title: 'New Draft',
        content: 'New content',
        category: null,
        tags: null,
        pathname: null,
        author: 'admin',
        version: 1,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      mockDraftService.create.mockResolvedValue(mockDraft);

      const handler = controller.createDraft();
      const result = await handler({ body: createDto });

      expect(result.status).toBe(201);
      expect(result.body.id).toBe(1);
      expect(result.body.title).toBe('New Draft');
      expect(result.body.content).toBe('New content');
      expect(mockDraftService.create).toHaveBeenCalledWith({
        title: 'New Draft',
        content: 'New content',
        category: null,
        tags: null,
        pathname: null,
        author: 'admin',
      });
    });

    it('should create draft with optional fields', async () => {
      const createDto = {
        title: 'New Draft',
        content: 'New content',
        category: 'tech',
        tags: ['test', 'draft'],
      };
      const mockDraft = {
        id: 1,
        ...createDto,
        pathname: null,
        author: 'admin',
        version: 1,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      mockDraftService.create.mockResolvedValue(mockDraft);

      const handler = controller.createDraft();
      const result = await handler({ body: createDto });

      expect(result.status).toBe(201);
      expect(result.body.category).toBe('tech');
      expect(result.body.tags).toEqual(['test', 'draft']);
      expect(mockDraftService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'tech',
          tags: ['test', 'draft'],
        }),
      );
    });

    it('should map response correctly', async () => {
      const mockDraft = {
        id: 1,
        title: 'Test',
        content: 'Content',
        category: null,
        tags: null,
        pathname: null,
        author: 'admin',
        version: 1,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      mockDraftService.create.mockResolvedValue(mockDraft);

      const handler = controller.createDraft();
      const result = await handler({ body: { title: 'Test', content: 'Content' } });

      expect(result.body.category).toBeUndefined();
      expect(result.body.tags).toBeUndefined();
    });
  });

  describe('updateDraft (ts-rest)', () => {
    it('should update draft with partial fields', async () => {
      const updateDto = {
        title: 'Updated Title',
      };
      const mockDraft = {
        id: 1,
        title: 'Updated Title',
        content: 'Original content',
        category: null,
        tags: null,
        pathname: null,
        author: 'admin',
        version: 2,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      mockDraftService.update.mockResolvedValue(mockDraft);

      const handler = controller.updateDraft();
      const result = await handler({ params: { id: '1' }, body: updateDto });

      expect(result.status).toBe(200);
      expect(result.body.title).toBe('Updated Title');
      expect(mockDraftService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          title: 'Updated Title',
        }),
      );
    });

    it('should update multiple fields', async () => {
      const updateDto = {
        title: 'Updated',
        content: 'Updated content',
        category: 'tech',
        tags: ['updated'],
      };
      const mockDraft = {
        id: 1,
        ...updateDto,
        pathname: null,
        author: 'admin',
        version: 2,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      mockDraftService.update.mockResolvedValue(mockDraft);

      const handler = controller.updateDraft();
      await handler({ params: { id: '1' }, body: updateDto });

      expect(mockDraftService.update).toHaveBeenCalledWith(1, expect.objectContaining(updateDto));
    });

    it('should handle undefined fields correctly', async () => {
      const updateDto = {
        title: 'Updated',
      };
      const mockDraft = {
        id: 1,
        title: 'Updated',
        content: 'Original',
        category: null,
        tags: null,
        pathname: null,
        author: 'admin',
        version: 2,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      mockDraftService.update.mockResolvedValue(mockDraft);

      const handler = controller.updateDraft();
      await handler({ params: { id: '1' }, body: updateDto });

      const updateData = mockDraftService.update.mock.calls[0][1];
      expect(updateData).toHaveProperty('title', 'Updated');
      expect(updateData).not.toHaveProperty('content');
      expect(updateData).not.toHaveProperty('category');
    });

    it('should convert string id to number', async () => {
      const mockDraft = {
        id: 123,
        title: 'Test',
        content: 'Content',
        category: null,
        tags: null,
        pathname: null,
        author: 'admin',
        version: 1,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      mockDraftService.update.mockResolvedValue(mockDraft);

      const handler = controller.updateDraft();
      await handler({ params: { id: '123' }, body: { title: 'Test' } });

      expect(mockDraftService.update).toHaveBeenCalledWith(123, expect.any(Object));
    });
  });

  describe('deleteDraft (ts-rest)', () => {
    it('should delete draft and return success', async () => {
      mockDraftService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteDraft();
      const result = await handler({ params: { id: '1' } });

      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
      expect(mockDraftService.remove).toHaveBeenCalledWith(1);
    });

    it('should convert string id to number', async () => {
      mockDraftService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteDraft();
      await handler({ params: { id: '456' } });

      expect(mockDraftService.remove).toHaveBeenCalledWith(456);
    });
  });

  describe('getDraft (ts-rest)', () => {
    it('should return single draft', async () => {
      const mockDraft = {
        id: 1,
        title: 'Test Draft',
        content: 'Test content',
        category: 'tech',
        tags: ['test'],
        pathname: null,
        author: 'admin',
        version: 1,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      mockDraftService.findOne.mockResolvedValue(mockDraft);

      const handler = controller.getDraft();
      const result = await handler({ params: { id: '1' } });

      expect(result.status).toBe(200);
      expect(result.body.id).toBe(1);
      expect(result.body.title).toBe('Test Draft');
      expect(result.body.category).toBe('tech');
      expect(result.body.tags).toEqual(['test']);
      expect(mockDraftService.findOne).toHaveBeenCalledWith(1);
    });

    it('should handle null category and tags', async () => {
      const mockDraft = {
        id: 1,
        title: 'Test Draft',
        content: 'Test content',
        category: null,
        tags: null,
        pathname: null,
        author: 'admin',
        version: 1,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      mockDraftService.findOne.mockResolvedValue(mockDraft);

      const handler = controller.getDraft();
      const result = await handler({ params: { id: '1' } });

      expect(result.body.category).toBeUndefined();
      expect(result.body.tags).toBeUndefined();
    });
  });

  describe('publishDraft (ts-rest)', () => {
    it('should publish draft and return article', async () => {
      const mockArticle = new Article({
        id: 99,
        title: 'Published Article',
        content: 'Published content',
        tags: [],
        author: 'admin',
        top: 0,
        hidden: false,
        private: false,
        password: null,
        viewer: 0,
        pathname: null,
        category: null,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });
      mockDraftService.publish.mockResolvedValue(mockArticle);

      const handler = controller.publishDraft();
      const result = await handler({ params: { id: '1' } });

      expect(result.status).toBe(200);
      expect(result.body.id).toBe(99);
      expect(result.body.title).toBe('Published Article');
      expect(result.body.isTop).toBe(false);
      expect(result.body.isHot).toBe(false);
      expect(result.body.likes).toBe(0);
      expect(result.body.private).toBe(false);
      expect(mockDraftService.publish).toHaveBeenCalledWith(1, {
        isPublished: true,
        isTop: false,
        password: null,
        allowComment: true,
      });
    });

    it('should map article fields correctly', async () => {
      const mockArticle = new Article({
        id: 1,
        title: 'Test',
        content: 'Content',
        tags: [],
        author: 'admin',
        top: 5,
        hidden: false,
        private: true,
        password: 'encrypted',
        viewer: 100,
        pathname: 'test-article',
        category: 'tech',
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });
      mockDraftService.publish.mockResolvedValue(mockArticle);

      const handler = controller.publishDraft();
      const result = await handler({ params: { id: '1' } });

      expect(result.body.isTop).toBe(true);
      expect(result.body.views).toBe(100);
      expect(result.body.private).toBe(true);
      expect(result.body.password).toBe('encrypted');
      expect(result.body.category).toBe('tech');
      expect(result.body.tags).toBeUndefined(); // Note: tags are undefined in controller
    });

    it('should handle null viewer and top', async () => {
      const mockArticle = new Article({
        id: 1,
        title: 'Test',
        content: 'Content',
        tags: [],
        author: 'admin',
        top: null,
        hidden: false,
        private: false,
        password: null,
        viewer: null,
        pathname: null,
        category: null,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });
      mockDraftService.publish.mockResolvedValue(mockArticle);

      const handler = controller.publishDraft();
      const result = await handler({ params: { id: '1' } });

      expect(result.body.isTop).toBe(false);
      expect(result.body.views).toBeUndefined();
    });

    it('should format pubTime correctly', async () => {
      const updatedAt = '2024-01-01T10:00:00Z';
      const mockArticle = new Article({
        id: 1,
        title: 'Test',
        content: 'Content',
        tags: [],
        author: 'admin',
        top: 0,
        hidden: false,
        private: false,
        password: null,
        viewer: 0,
        pathname: null,
        category: null,
        createdAt: dayjs().format(),
        updatedAt,
      });
      mockDraftService.publish.mockResolvedValue(mockArticle);

      const handler = controller.publishDraft();
      const result = await handler({ params: { id: '1' } });

      expect(result.body.pubTime).toBe(dayjs(updatedAt).format());
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
        category: null,
        tags: [],
        pathname: null,
        author: 'admin',
        version: 1,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      };
      mockDraftService.findOne.mockResolvedValue(mockDraft);

      const handler = controller.getDraft();
      const result = await handler({ params: { id: '1' } });

      expect(result.body.tags).toEqual([]);
    });

    it('should handle special characters in draft title', async () => {
      const dto = {
        title: 'Special chars: @#$%^&*()',
        content: 'Content',
        author: 'admin',
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
      };
      mockDraftService.create.mockResolvedValue(mockDraft);

      // Valid DTO
      await expect(
        controller.create({ title: 'Test', content: 'Content', author: 'admin' }),
      ).resolves.toBeDefined();

      // Invalid DTO - missing required fields
      await expect(controller.create({ title: 'Test' })).rejects.toThrow();
    });

    it('should validate update draft DTO', async () => {
      const mockDraft = { id: 1, title: 'Updated' };
      mockDraftService.update.mockResolvedValue(mockDraft);

      // Valid update
      await expect(controller.update(1, { title: 'Updated' })).resolves.toBeDefined();

      // Empty update is valid (partial update)
      await expect(controller.update(1, {})).resolves.toBeDefined();
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
          { title: 'Draft 1', content: 'Content 1', author: 'admin' },
          { title: 'Draft 2', content: 'Content 2', author: 'admin' },
        ]),
      ).resolves.toBeUndefined();

      // Invalid - not an array
      await expect(controller.importDrafts({ title: 'Test' })).rejects.toThrow();
    });
  });
});
