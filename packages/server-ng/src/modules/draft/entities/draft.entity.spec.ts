import { describe, it, expect } from 'vitest';
import { Draft, DraftVersion } from './draft.entity';

describe('Draft Entity', () => {
  describe('constructor', () => {
    it('should create a draft with all fields', () => {
      const draft = new Draft({
        id: 1,
        title: 'Draft Title',
        content: 'Draft content here',
        pathname: '/draft-title',
        tags: ['tag1', 'tag2'],
        categories: ['tech'],
        category: 'Technology',
        author: 'admin',
        version: 1,
        userId: 1,
        wordCount: 100,
        readTime: 5,
        summary: 'A summary',
        cover: '/image.jpg',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      });

      expect(draft.id).toBe(1);
      expect(draft.title).toBe('Draft Title');
      expect(draft.content).toBe('Draft content here');
      expect(draft.pathname).toBe('/draft-title');
      expect(draft.tags).toEqual(['tag1', 'tag2']);
      expect(draft.categories).toEqual(['tech']);
      expect(draft.category).toBe('Technology');
      expect(draft.author).toBe('admin');
      expect(draft.version).toBe(1);
      expect(draft.userId).toBe(1);
      expect(draft.wordCount).toBe(100);
      expect(draft.readTime).toBe(5);
      expect(draft.summary).toBe('A summary');
      expect(draft.cover).toBe('/image.jpg');
      expect(draft.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(draft.updatedAt).toBe('2024-01-02T00:00:00Z');
    });

    it('should create a draft with partial fields', () => {
      const draft = new Draft({
        id: 1,
        title: 'Title',
        content: 'Content',
      });

      expect(draft.id).toBe(1);
      expect(draft.title).toBe('Title');
      expect(draft.content).toBe('Content');
      expect(draft.pathname).toBeUndefined();
      expect(draft.tags).toBeUndefined();
    });

    it('should create an empty draft', () => {
      const draft = new Draft({});

      expect(draft.id).toBeUndefined();
      expect(draft.title).toBeUndefined();
    });

    it('should handle null values', () => {
      const draft = new Draft({
        id: 1,
        title: 'Test',
        content: 'Content',
        pathname: null,
        category: null,
      });

      expect(draft.pathname).toBeNull();
      expect(draft.category).toBeNull();
    });

    it('should handle array fields', () => {
      const draft = new Draft({
        id: 1,
        title: 'Test',
        content: 'Content',
        tags: ['tag1', 'tag2', 'tag3'],
        categories: ['cat1', 'cat2'],
      });

      expect(draft.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(draft.categories).toEqual(['cat1', 'cat2']);
      expect(draft.tags).toHaveLength(3);
      expect(draft.categories).toHaveLength(2);
    });

    it('should handle optional fields', () => {
      const draft = new Draft({
        id: 1,
        title: 'Test',
        content: 'Content',
        tags: [],
        categories: [],
        author: 'author',
        version: 1,
        userId: 1,
        wordCount: 50,
        readTime: 2,
      });

      expect(draft.summary).toBeUndefined();
      expect(draft.cover).toBeUndefined();
    });
  });

  describe('properties', () => {
    it('should allow modification of draft properties', () => {
      const draft = new Draft({
        id: 1,
        title: 'Original',
      });

      draft.title = 'Modified';
      draft.content = 'New content';

      expect(draft.title).toBe('Modified');
      expect(draft.content).toBe('New content');
    });
  });

  describe('type checking', () => {
    it('should be instance of Draft', () => {
      const draft = new Draft({ id: 1, title: 'Test', content: 'Content' });

      expect(draft).toBeInstanceOf(Draft);
    });
  });
});

describe('DraftVersion Entity', () => {
  describe('constructor', () => {
    it('should create a draft version with all fields', () => {
      const version = new DraftVersion({
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Version Title',
        content: 'Version content',
        pathname: '/version-title',
        tags: ['tag1'],
        categories: ['cat1'],
        category: 'Technology',
        author: 'admin',
        summary: 'Summary text',
        cover: '/cover.jpg',
        createdAt: '2024-01-01T00:00:00Z',
        comment: 'Version comment',
      });

      expect(version.id).toBe(1);
      expect(version.draftId).toBe(1);
      expect(version.version).toBe(1);
      expect(version.title).toBe('Version Title');
      expect(version.content).toBe('Version content');
      expect(version.pathname).toBe('/version-title');
      expect(version.tags).toEqual(['tag1']);
      expect(version.categories).toEqual(['cat1']);
      expect(version.category).toBe('Technology');
      expect(version.author).toBe('admin');
      expect(version.summary).toBe('Summary text');
      expect(version.cover).toBe('/cover.jpg');
      expect(version.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(version.comment).toBe('Version comment');
    });

    it('should create a draft version with partial fields', () => {
      const version = new DraftVersion({
        id: 1,
        draftId: 1,
        version: 2,
        title: 'Title',
        content: 'Content',
      });

      expect(version.id).toBe(1);
      expect(version.draftId).toBe(1);
      expect(version.version).toBe(2);
      expect(version.title).toBe('Title');
      expect(version.content).toBe('Content');
    });

    it('should create an empty draft version', () => {
      const version = new DraftVersion({});

      expect(version.id).toBeUndefined();
      expect(version.draftId).toBeUndefined();
    });

    it('should handle null pathname and category', () => {
      const version = new DraftVersion({
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Test',
        content: 'Content',
        pathname: null,
        category: null,
      });

      expect(version.pathname).toBeNull();
      expect(version.category).toBeNull();
    });

    it('should handle optional fields', () => {
      const version = new DraftVersion({
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Title',
        content: 'Content',
        tags: [],
        categories: [],
        author: 'author',
      });

      expect(version.summary).toBeUndefined();
      expect(version.cover).toBeUndefined();
      expect(version.comment).toBeUndefined();
    });
  });

  describe('properties', () => {
    it('should allow modification of version properties', () => {
      const version = new DraftVersion({
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Original',
        content: 'Original content',
      });

      version.title = 'Modified';
      version.comment = 'Updated comment';

      expect(version.title).toBe('Modified');
      expect(version.comment).toBe('Updated comment');
    });

    it('should support version increments', () => {
      const version = new DraftVersion({
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Title',
        content: 'Content',
        tags: [],
        categories: [],
        author: 'admin',
      });

      version.version = 2;

      expect(version.version).toBe(2);
    });
  });

  describe('type checking', () => {
    it('should be instance of DraftVersion', () => {
      const version = new DraftVersion({
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Test',
        content: 'Content',
        tags: [],
        categories: [],
        author: 'admin',
      });

      expect(version).toBeInstanceOf(DraftVersion);
    });
  });

  describe('version tracking', () => {
    it('should maintain version history information', () => {
      const v1 = new DraftVersion({
        id: 1,
        draftId: 1,
        version: 1,
        title: 'Title V1',
        content: 'Content V1',
        tags: [],
        categories: [],
        author: 'admin',
        createdAt: '2024-01-01T00:00:00Z',
      });

      const v2 = new DraftVersion({
        id: 2,
        draftId: 1,
        version: 2,
        title: 'Title V2',
        content: 'Content V2',
        tags: [],
        categories: [],
        author: 'admin',
        createdAt: '2024-01-02T00:00:00Z',
      });

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v1.draftId).toBe(v2.draftId);
    });
  });
});
