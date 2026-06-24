import { describe, it, expect } from 'vitest';
import { NavigationItemSchema, UpdateNavigationSchema } from './navigation.dto';

describe('Navigation DTOs', () => {
  describe('NavigationItemSchema', () => {
    it('should validate simple navigation item', () => {
      const item = {
        name: 'Home',
        path: '/',
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Home');
        expect(result.data.path).toBe('/');
      }
    });

    it('should validate navigation with icon', () => {
      const item = {
        name: 'Blog',
        path: '/blog',
        icon: 'fa-blog',
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should validate navigation with external flag', () => {
      const item = {
        name: 'GitHub',
        path: 'https://github.com/example',
        external: true,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.external).toBe(true);
      }
    });

    it('should reject missing name', () => {
      const item = {
        path: '/',
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should reject missing path', () => {
      const item = {
        name: 'Home',
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const item = {
        name: '',
        path: '/',
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should reject empty path', () => {
      const item = {
        name: 'Home',
        path: '',
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should validate nested children', () => {
      const item = {
        name: 'Products',
        path: '/products',
        children: [
          {
            name: 'Product 1',
            path: '/products/1',
          },
          {
            name: 'Product 2',
            path: '/products/2',
            external: true,
          },
        ],
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.children).toHaveLength(2);
      }
    });

    it('should validate with id', () => {
      const item = {
        id: 1,
        name: 'Home',
        path: '/',
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should handle complex hierarchies', () => {
      const item = {
        name: 'Services',
        path: '/services',
        children: [
          {
            name: 'Consulting',
            path: '/services/consulting',
            children: [
              {
                name: 'Strategy',
                path: '/services/consulting/strategy',
              },
            ],
          },
        ],
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });
  });

  describe('UpdateNavigationSchema', () => {
    it('should validate navigation list update', () => {
      const update = {
        items: [
          {
            name: 'Home',
            path: '/',
          },
          {
            name: 'About',
            path: '/about',
          },
        ],
      };

      const result = UpdateNavigationSchema.safeParse(update);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
      }
    });

    it('should validate empty items array', () => {
      const update = {
        items: [],
      };

      const result = UpdateNavigationSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should reject missing items', () => {
      const update = {};

      const result = UpdateNavigationSchema.safeParse(update);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle unicode in navigation names', () => {
      const item = {
        name: '技术分享 Tech Blog',
        path: '/blog',
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should handle complex URLs', () => {
      const item = {
        name: 'API Docs',
        path: 'https://api.example.com/v2/docs?lang=en&theme=dark',
        external: true,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should handle relative paths', () => {
      const item = {
        name: 'Resources',
        path: '../resources',
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });
  });
});
