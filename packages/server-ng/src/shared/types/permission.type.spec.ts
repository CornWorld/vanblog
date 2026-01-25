import { describe, it, expect } from 'vitest';
import type { LimitPermission, Permission } from './permission.type';

describe('Permission Types', () => {
  describe('LimitPermission', () => {
    it('should accept valid article permissions', () => {
      const createPerm: LimitPermission = 'article:create';
      const deletePerm: LimitPermission = 'article:delete';
      const updatePerm: LimitPermission = 'article:update';

      expect(createPerm).toBe('article:create');
      expect(deletePerm).toBe('article:delete');
      expect(updatePerm).toBe('article:update');
    });

    it('should accept valid draft permissions', () => {
      const publishPerm: LimitPermission = 'draft:publish';
      const createPerm: LimitPermission = 'draft:create';
      const deletePerm: LimitPermission = 'draft:delete';
      const updatePerm: LimitPermission = 'draft:update';

      expect(publishPerm).toBe('draft:publish');
      expect(createPerm).toBe('draft:create');
      expect(deletePerm).toBe('draft:delete');
      expect(updatePerm).toBe('draft:update');
    });

    it('should accept valid image permission', () => {
      const imgDeletePerm: LimitPermission = 'img:delete';

      expect(imgDeletePerm).toBe('img:delete');
    });

    it('should enforce type safety at compile time', () => {
      const permissions: LimitPermission[] = [
        'article:create',
        'article:delete',
        'article:update',
        'draft:publish',
        'draft:create',
        'draft:delete',
        'draft:update',
        'img:delete',
      ];

      expect(permissions).toHaveLength(8);
      expect(permissions).toContain('article:create');
      expect(permissions).toContain('article:delete');
      expect(permissions).toContain('article:update');
      expect(permissions).toContain('draft:publish');
      expect(permissions).toContain('draft:create');
      expect(permissions).toContain('draft:delete');
      expect(permissions).toContain('draft:update');
      expect(permissions).toContain('img:delete');
    });

    it('should be usable in arrays', () => {
      const userPermissions: LimitPermission[] = ['article:create', 'article:update'];

      expect(userPermissions).toHaveLength(2);
      expect(userPermissions[0]).toBe('article:create');
      expect(userPermissions[1]).toBe('article:update');
    });

    it('should be usable in Sets', () => {
      const permissionSet = new Set<LimitPermission>([
        'article:create',
        'article:delete',
        'article:create', // Duplicate
      ]);

      expect(permissionSet.size).toBe(2);
      expect(permissionSet.has('article:create')).toBe(true);
      expect(permissionSet.has('article:delete')).toBe(true);
    });

    it('should be usable as object keys', () => {
      const permissionDescriptions: Record<LimitPermission, string> = {
        'article:create': 'Create articles',
        'article:delete': 'Delete articles',
        'article:update': 'Update articles',
        'draft:publish': 'Publish drafts',
        'draft:create': 'Create drafts',
        'draft:delete': 'Delete drafts',
        'draft:update': 'Update drafts',
        'img:delete': 'Delete images',
      };

      expect(permissionDescriptions['article:create']).toBe('Create articles');
      expect(permissionDescriptions['draft:publish']).toBe('Publish drafts');
      expect(permissionDescriptions['img:delete']).toBe('Delete images');
    });
  });

  describe('Permission', () => {
    it('should accept all LimitPermission values', () => {
      const createPerm: Permission = 'article:create';
      const deletePerm: Permission = 'article:delete';
      const updatePerm: Permission = 'article:update';
      const publishPerm: Permission = 'draft:publish';
      const draftCreatePerm: Permission = 'draft:create';
      const draftDeletePerm: Permission = 'draft:delete';
      const draftUpdatePerm: Permission = 'draft:update';
      const imgDeletePerm: Permission = 'img:delete';

      expect(createPerm).toBe('article:create');
      expect(deletePerm).toBe('article:delete');
      expect(updatePerm).toBe('article:update');
      expect(publishPerm).toBe('draft:publish');
      expect(draftCreatePerm).toBe('draft:create');
      expect(draftDeletePerm).toBe('draft:delete');
      expect(draftUpdatePerm).toBe('draft:update');
      expect(imgDeletePerm).toBe('img:delete');
    });

    it('should accept the special "all" permission', () => {
      const allPerm: Permission = 'all';

      expect(allPerm).toBe('all');
    });

    it('should be usable in arrays with mixed permissions', () => {
      const permissions: Permission[] = ['article:create', 'all', 'draft:delete'];

      expect(permissions).toHaveLength(3);
      expect(permissions).toContain('article:create');
      expect(permissions).toContain('all');
      expect(permissions).toContain('draft:delete');
    });

    it('should be usable in conditional logic', () => {
      const checkPermission = (perm: Permission): boolean => {
        if (perm === 'all') {
          return true;
        }
        return ['article:create', 'article:update'].includes(perm);
      };

      expect(checkPermission('all')).toBe(true);
      expect(checkPermission('article:create')).toBe(true);
      expect(checkPermission('article:delete')).toBe(false);
    });

    it('should support type narrowing', () => {
      const isAllPermission = (perm: Permission): perm is 'all' => {
        return perm === 'all';
      };

      const isLimitPermission = (perm: Permission): perm is LimitPermission => {
        return perm !== 'all';
      };

      const allPerm: Permission = 'all';
      const limitPerm: Permission = 'article:create';

      expect(isAllPermission(allPerm)).toBe(true);
      expect(isAllPermission(limitPerm)).toBe(false);
      expect(isLimitPermission(allPerm)).toBe(false);
      expect(isLimitPermission(limitPerm)).toBe(true);
    });

    it('should be usable in permission checking functions', () => {
      const hasPermission = (
        userPermissions: Permission[],
        requiredPermission: Permission,
      ): boolean => {
        return userPermissions.includes('all') || userPermissions.includes(requiredPermission);
      };

      expect(hasPermission(['all'], 'article:create')).toBe(true);
      expect(hasPermission(['article:create'], 'article:create')).toBe(true);
      expect(hasPermission(['article:update'], 'article:create')).toBe(false);
    });

    it('should be usable in Sets with "all" permission', () => {
      const permissionSet = new Set<Permission>(['all', 'article:create']);

      expect(permissionSet.size).toBe(2);
      expect(permissionSet.has('all')).toBe(true);
      expect(permissionSet.has('article:create')).toBe(true);
    });
  });

  describe('Permission Validation Helpers', () => {
    const ALL_LIMIT_PERMISSIONS: LimitPermission[] = [
      'article:create',
      'article:delete',
      'article:update',
      'draft:publish',
      'draft:create',
      'draft:delete',
      'draft:update',
      'img:delete',
    ];

    it('should validate if a string is a valid LimitPermission', () => {
      const isValidLimitPermission = (value: string): value is LimitPermission => {
        return ALL_LIMIT_PERMISSIONS.includes(value as LimitPermission);
      };

      expect(isValidLimitPermission('article:create')).toBe(true);
      expect(isValidLimitPermission('draft:publish')).toBe(true);
      expect(isValidLimitPermission('img:delete')).toBe(true);
      expect(isValidLimitPermission('invalid:permission')).toBe(false);
      expect(isValidLimitPermission('all')).toBe(false);
    });

    it('should validate if a string is a valid Permission', () => {
      const isValidPermission = (value: string): value is Permission => {
        return value === 'all' || ALL_LIMIT_PERMISSIONS.includes(value as LimitPermission);
      };

      expect(isValidPermission('article:create')).toBe(true);
      expect(isValidPermission('all')).toBe(true);
      expect(isValidPermission('invalid:permission')).toBe(false);
    });

    it('should extract resource from permission string', () => {
      const getResource = (perm: LimitPermission): string => {
        return perm.split(':')[0];
      };

      expect(getResource('article:create')).toBe('article');
      expect(getResource('draft:publish')).toBe('draft');
      expect(getResource('img:delete')).toBe('img');
    });

    it('should extract action from permission string', () => {
      const getAction = (perm: LimitPermission): string => {
        return perm.split(':')[1];
      };

      expect(getAction('article:create')).toBe('create');
      expect(getAction('draft:publish')).toBe('publish');
      expect(getAction('img:delete')).toBe('delete');
    });

    it('should group permissions by resource', () => {
      const groupByResource = (
        permissions: LimitPermission[],
      ): Record<string, LimitPermission[]> => {
        return permissions.reduce<Record<string, LimitPermission[]>>((acc, perm) => {
          const [resource] = perm.split(':');
          if (!(resource in acc)) {
            acc[resource] = [];
          }
          acc[resource].push(perm);
          return acc;
        }, {});
      };

      const grouped = groupByResource(ALL_LIMIT_PERMISSIONS);

      expect(grouped['article']).toHaveLength(3);
      expect(grouped['draft']).toHaveLength(4);
      expect(grouped['img']).toHaveLength(1);
      expect(grouped['article']).toContain('article:create');
      expect(grouped['article']).toContain('article:delete');
      expect(grouped['article']).toContain('article:update');
    });

    it('should filter permissions by resource', () => {
      const filterByResource = (
        permissions: LimitPermission[],
        resource: string,
      ): LimitPermission[] => {
        return permissions.filter((perm) => perm.startsWith(`${resource}:`));
      };

      const articlePermissions = filterByResource(ALL_LIMIT_PERMISSIONS, 'article');
      const draftPermissions = filterByResource(ALL_LIMIT_PERMISSIONS, 'draft');
      const imgPermissions = filterByResource(ALL_LIMIT_PERMISSIONS, 'img');

      expect(articlePermissions).toHaveLength(3);
      expect(draftPermissions).toHaveLength(4);
      expect(imgPermissions).toHaveLength(1);
    });

    it('should check if user has required permission', () => {
      const hasRequiredPermission = (
        userPermissions: Permission[],
        required: Permission,
      ): boolean => {
        if (userPermissions.includes('all')) {
          return true;
        }
        return userPermissions.includes(required);
      };

      expect(hasRequiredPermission(['all'], 'article:create')).toBe(true);
      expect(hasRequiredPermission(['article:create', 'article:update'], 'article:create')).toBe(
        true,
      );
      expect(hasRequiredPermission(['article:create'], 'article:delete')).toBe(false);
    });

    it('should check if user has any of the required permissions', () => {
      const hasAnyPermission = (userPermissions: Permission[], required: Permission[]): boolean => {
        if (userPermissions.includes('all')) {
          return true;
        }
        return required.some((perm) => userPermissions.includes(perm));
      };

      expect(hasAnyPermission(['article:create'], ['article:create', 'article:update'])).toBe(true);
      expect(hasAnyPermission(['all'], ['article:create', 'article:update'])).toBe(true);
      expect(hasAnyPermission(['draft:create'], ['article:create', 'article:update'])).toBe(false);
    });
  });
});
