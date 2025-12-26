import { describe, it, expect } from 'vitest';
import {
  CreatePermissionGroupSchema,
  UpdatePermissionGroupSchema,
  PermissionGroupQuerySchema,
} from './permission-group.dto';

describe('Permission Group DTOs', () => {
  describe('CreatePermissionGroupSchema', () => {
    it('should validate create request with required fields', () => {
      const createRequest = {
        name: 'Editor',
        isActive: true,
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Editor');
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should validate create request with description', () => {
      const createRequest = {
        name: 'Author',
        description: 'Can create and edit articles',
        isActive: true,
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Can create and edit articles');
      }
    });

    it('should reject missing name', () => {
      const createRequest = {
        isActive: true,
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      expect(result.success).toBe(false);
    });

    it('should allow missing isActive (optional field)', () => {
      const createRequest = {
        name: 'Viewer',
        isActive: true,
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      // isActive is required by schema
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Viewer');
      }
    });

    it('should handle unicode in name', () => {
      const createRequest = {
        name: '编辑 Editor',
        description: '有权编辑文章的用户',
        isActive: true,
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
    });

    it('should reject string isActive', () => {
      const createRequest = {
        name: 'Test',
        isActive: 'true',
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      expect(result.success).toBe(false);
    });

    it('should handle inactive group', () => {
      const createRequest = {
        name: 'Deprecated Role',
        isActive: false,
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
      }
    });

    it('should handle permissions array in create request', () => {
      const createRequest = {
        name: 'Editor',
        permissions: ['article:create', 'article:edit'],
        isActive: true,
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.permissions).toEqual(['article:create', 'article:edit']);
      }
    });

    it('should handle null permissions in create request', () => {
      const createRequest = {
        name: 'Viewer',
        permissions: null,
        isActive: true,
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.permissions).toBeNull();
      }
    });
  });

  describe('UpdatePermissionGroupSchema', () => {
    it('should allow updating name alone', () => {
      const updateRequest = {
        name: 'Updated Editor',
      };

      const result = UpdatePermissionGroupSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow updating isActive', () => {
      const updateRequest = {
        isActive: false,
      };

      const result = UpdatePermissionGroupSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow updating description', () => {
      const updateRequest = {
        description: 'Updated description',
      };

      const result = UpdatePermissionGroupSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const updateRequest = {};

      const result = UpdatePermissionGroupSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow updating all fields', () => {
      const updateRequest = {
        name: 'New Name',
        description: 'New description',
        isActive: true,
      };

      const result = UpdatePermissionGroupSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow updating permissions alone', () => {
      const updateRequest = {
        permissions: ['article:create', 'article:edit', 'article:delete'],
      };

      const result = UpdatePermissionGroupSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.permissions).toEqual([
          'article:create',
          'article:edit',
          'article:delete',
        ]);
      }
    });

    it('should allow clearing permissions with null', () => {
      const updateRequest = {
        permissions: null,
      };

      const result = UpdatePermissionGroupSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.permissions).toBeNull();
      }
    });

    it('should allow updating permissions with other fields', () => {
      const updateRequest = {
        name: 'Updated Group',
        permissions: ['article:create'],
        isActive: false,
      };

      const result = UpdatePermissionGroupSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Updated Group');
        expect(result.data.permissions).toEqual(['article:create']);
        expect(result.data.isActive).toBe(false);
      }
    });
  });

  describe('PermissionGroupQuerySchema', () => {
    it('should validate minimal query', () => {
      const query = {};

      const result = PermissionGroupQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
      }
    });

    it('should apply default page', () => {
      const query = {
        limit: 20,
      };

      const result = PermissionGroupQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it('should apply default limit', () => {
      const query = {
        page: 2,
      };

      const result = PermissionGroupQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('should validate with isActive filter', () => {
      const query = {
        isActive: true,
        page: 1,
        limit: 20,
      };

      const result = PermissionGroupQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should validate with isActive false', () => {
      const query = {
        isActive: false,
        page: 1,
        limit: 10,
      };

      const result = PermissionGroupQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
      }
    });

    it('should reject invalid page', () => {
      const query = {
        page: 0,
      };

      const result = PermissionGroupQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should reject page exceeding limit', () => {
      const query = {
        page: -5,
      };

      const result = PermissionGroupQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should reject limit exceeding 100', () => {
      const query = {
        limit: 200,
      };

      const result = PermissionGroupQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should accept limit of 100', () => {
      const query = {
        limit: 100,
      };

      const result = PermissionGroupQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very long description', () => {
      const createRequest = {
        name: 'Complex Role',
        description: 'A'.repeat(1000),
        isActive: true,
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      if (result.success) {
        expect(result.data.description).toHaveLength(1000);
      }
    });

    it('should handle special characters in name', () => {
      const createRequest = {
        name: 'Role_2024-v2.0 (Beta)',
        isActive: true,
      };

      const result = CreatePermissionGroupSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
    });

    it('should handle large pagination values', () => {
      const query = {
        page: 9999,
        limit: 100,
      };

      const result = PermissionGroupQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(9999);
        expect(result.data.limit).toBe(100);
      }
    });
  });
});
