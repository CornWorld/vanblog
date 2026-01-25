import { describe, it, expect } from 'vitest';
import { Category } from './category.entity';

describe('Category Entity', () => {
  describe('constructor', () => {
    it('should create a category with all fields', () => {
      const category = new Category({
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: 'Technology articles',
        private: false,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      });

      expect(category.id).toBe(1);
      expect(category.name).toBe('Technology');
      expect(category.slug).toBe('tech');
      expect(category.description).toBe('Technology articles');
      expect(category.private).toBe(false);
      expect(category.password).toBeNull();
      expect(category.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(category.updatedAt).toBe('2024-01-02T00:00:00Z');
    });

    it('should create a category with partial fields', () => {
      const category = new Category({
        id: 1,
        name: 'Tech',
      });

      expect(category.id).toBe(1);
      expect(category.name).toBe('Tech');
      expect(category.slug).toBeUndefined();
      expect(category.description).toBeUndefined();
    });

    it('should create an empty category', () => {
      const category = new Category({});

      expect(category.id).toBeUndefined();
      expect(category.name).toBeUndefined();
    });

    it('should handle null values', () => {
      const category = new Category({
        id: 1,
        name: 'Category',
        slug: null,
        description: null,
        private: null,
        password: null,
      });

      expect(category.slug).toBeNull();
      expect(category.description).toBeNull();
      expect(category.private).toBeNull();
      expect(category.password).toBeNull();
    });

    it('should allow partial initialization', () => {
      const partial = {
        name: 'Partial Category',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const category = new Category(partial);

      expect(category.name).toBe('Partial Category');
      expect(category.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(category.id).toBeUndefined();
    });

    it('should support chaining-like operations', () => {
      const category = new Category({
        id: 1,
        name: 'Test Category',
      });

      // Test property access
      expect(category).toHaveProperty('id', 1);
      expect(category).toHaveProperty('name', 'Test Category');
    });

    it('should handle private categories with passwords', () => {
      const category = new Category({
        id: 1,
        name: 'Private Category',
        private: true,
        password: '$2b$10$hashed',
      });

      expect(category.private).toBe(true);
      expect(category.password).toBe('$2b$10$hashed');
    });
  });

  describe('properties', () => {
    it('should allow modification of category properties', () => {
      const category = new Category({
        id: 1,
        name: 'Original',
      });

      category.name = 'Modified';
      category.description = 'A description';

      expect(category.name).toBe('Modified');
      expect(category.description).toBe('A description');
    });

    it('should support setting optional properties after initialization', () => {
      const category = new Category({ id: 1, name: 'Test' });

      category.slug = 'test-slug';
      category.description = 'Test description';
      category.private = true;
      category.password = 'hashed';

      expect(category.slug).toBe('test-slug');
      expect(category.description).toBe('Test description');
      expect(category.private).toBe(true);
      expect(category.password).toBe('hashed');
    });

    it('should track created and updated timestamps', () => {
      const now = new Date().toISOString();
      const category = new Category({
        id: 1,
        name: 'Test',
        createdAt: now,
        updatedAt: now,
      });

      expect(category.createdAt).toBe(now);
      expect(category.updatedAt).toBe(now);
    });
  });

  describe('type checking', () => {
    it('should be instance of Category', () => {
      const category = new Category({ id: 1, name: 'Test' });

      expect(category).toBeInstanceOf(Category);
    });

    it('should contain required properties', () => {
      const category = new Category({
        id: 1,
        name: 'Test Category',
        slug: 'test',
        description: 'Test',
        private: false,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      const keys = Object.keys(category);
      expect(keys).toContain('id');
      expect(keys).toContain('name');
    });
  });

  describe('edge cases', () => {
    it('should handle unicode characters in name and description', () => {
      const category = new Category({
        id: 1,
        name: '技术',
        description: '技术文章',
        slug: 'tech-cn',
      });

      expect(category.name).toBe('技术');
      expect(category.description).toBe('技术文章');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      const category = new Category({
        id: 1,
        name: 'Category',
        description: longString,
      });

      expect(category.description).toBe(longString);
      expect(category.description).toHaveLength(1000);
    });

    it('should handle special characters in slug', () => {
      const category = new Category({
        id: 1,
        name: 'Category',
        slug: 'test-slug-123_special',
      });

      expect(category.slug).toBe('test-slug-123_special');
    });
  });
});
