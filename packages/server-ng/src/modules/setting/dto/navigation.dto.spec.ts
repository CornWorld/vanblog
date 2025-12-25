import { describe, it, expect } from 'vitest';
import { NavigationItemSchema, UpdateNavigationSchema } from './navigation.dto';

describe('Navigation DTOs', () => {
  describe('NavigationItemSchema', () => {
    it('should validate simple navigation item', () => {
      const item = {
        name: 'Home',
        url: '/',
        target: '_self' as const,
        order: 0,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Home');
        expect(result.data.url).toBe('/');
        expect(result.data.target).toBe('_self');
      }
    });

    it('should validate navigation with default target', () => {
      const item = {
        name: 'About',
        url: '/about',
        order: 1,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.target).toBe('_self');
      }
    });

    it('should validate navigation with default order', () => {
      const item = {
        name: 'Services',
        url: '/services',
        target: '_blank' as const,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.order).toBe(0);
      }
    });

    it('should validate navigation with icon', () => {
      const item = {
        name: 'Blog',
        url: '/blog',
        icon: 'fa-blog',
        target: '_self' as const,
        order: 2,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should validate external link with blank target', () => {
      const item = {
        name: 'GitHub',
        url: 'https://github.com/example',
        target: '_blank' as const,
        order: 3,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.target).toBe('_blank');
      }
    });

    it('should reject missing name', () => {
      const item = {
        url: '/',
        target: '_self' as const,
        order: 0,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should reject missing url', () => {
      const item = {
        name: 'Home',
        target: '_self' as const,
        order: 0,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const item = {
        name: '',
        url: '/',
        target: '_self' as const,
        order: 0,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should reject empty url', () => {
      const item = {
        name: 'Home',
        url: '',
        target: '_self' as const,
        order: 0,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should reject invalid target', () => {
      const item = {
        name: 'Home',
        url: '/',
        target: '_invalid',
        order: 0,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('should validate nested children', () => {
      const item = {
        name: 'Products',
        url: '/products',
        target: '_self' as const,
        order: 0,
        children: [
          {
            name: 'Product 1',
            url: '/products/1',
            target: '_self' as const,
            order: 0,
          },
          {
            name: 'Product 2',
            url: '/products/2',
            target: '_blank' as const,
            order: 1,
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
        url: '/',
        target: '_self' as const,
        order: 0,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should handle complex hierarchies', () => {
      const item = {
        name: 'Services',
        url: '/services',
        target: '_self' as const,
        order: 0,
        children: [
          {
            name: 'Consulting',
            url: '/services/consulting',
            target: '_self' as const,
            order: 0,
            children: [
              {
                name: 'Strategy',
                url: '/services/consulting/strategy',
                target: '_self' as const,
                order: 0,
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
            url: '/',
            target: '_self' as const,
            order: 0,
          },
          {
            name: 'About',
            url: '/about',
            target: '_self' as const,
            order: 1,
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
        name: '技术分享 🚀 Tech Blog',
        url: '/blog',
        target: '_self' as const,
        order: 0,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should handle complex URLs', () => {
      const item = {
        name: 'API Docs',
        url: 'https://api.example.com/v2/docs?lang=en&theme=dark',
        target: '_blank' as const,
        order: 0,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should handle relative paths', () => {
      const item = {
        name: 'Resources',
        url: '../resources',
        target: '_self' as const,
        order: 0,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should handle large order numbers', () => {
      const item = {
        name: 'Last Item',
        url: '/last',
        target: '_self' as const,
        order: 9999,
      };

      const result = NavigationItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.order).toBe(9999);
      }
    });
  });
});
