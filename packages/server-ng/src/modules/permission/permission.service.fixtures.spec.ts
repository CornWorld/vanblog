import { Test, type TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import { describe, beforeEach, afterEach, expect, vi } from 'vitest';

import { configTest } from '../../../test/vitest-fixtures.test';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { PERMISSION_MODULES, PERMISSION_GROUPS } from '../../shared/types/permission';

import { PermissionService } from './permission.service';

type MockQueryBuilder = {
  from: () => MockQueryBuilder;
  where: () => MockQueryBuilder;
  limit: () => MockQueryBuilder;
  offset: () => MockQueryBuilder;
  values: () => MockQueryBuilder;
  returning: () => Promise<unknown[]>;
  orderBy: () => MockQueryBuilder;
  set: () => MockQueryBuilder;
};

const mockPermissionNode = {
  id: 1,
  name: 'article:read',
  description: 'Read articles',
  module: 'article',
  createdAt: dayjs('2025-08-08T06:36:15.292Z'),
  updatedAt: dayjs('2025-08-08T06:36:15.292Z'),
};

const mockPermissionGroup = {
  id: 1,
  name: 'admin',
  description: 'Administrator group',
  permissions: JSON.stringify(['article:read', 'article:write']),
  createdAt: dayjs('2025-08-08T06:36:15.292Z'),
  updatedAt: dayjs('2025-08-08T06:36:15.292Z'),
};

describe('PermissionService with Vitest Fixtures', () => {
  let service: PermissionService;
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  configTest('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerPermission', () => {
    configTest('should register new permission node', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis() as () => MockQueryBuilder,
        where: vi.fn().mockReturnThis() as () => MockQueryBuilder,
        limit: vi.fn().mockResolvedValue([]) as () => MockQueryBuilder,
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnThis() as () => MockQueryBuilder,
        returning: vi.fn().mockResolvedValue([mockPermissionNode]) as () => Promise<unknown[]>,
      });

      await service.registerPermission({
        name: 'article:read',
        description: 'Read articles',
        module: 'article',
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    configTest('should not register existing permission node', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis() as () => MockQueryBuilder,
        where: vi.fn().mockReturnThis() as () => MockQueryBuilder,
        limit: vi.fn().mockResolvedValue([mockPermissionNode]) as () => MockQueryBuilder,
      });

      await service.registerPermission({
        name: 'article:read',
        description: 'Read articles',
        module: 'article',
      });

      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('resolveUserPermissions', () => {
    beforeEach(() => {
      // Mock getGroupPermissions method
      vi.spyOn(
        service as unknown as { getGroupPermissions: () => Promise<string[]> },
        'getGroupPermissions',
      ).mockResolvedValue(['article:read', 'article:write', 'user:read']);
    });

    configTest('should resolve basic permissions', async () => {
      const userPermissions = ['article:read', 'user:write'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['article:read', 'user:write']);
    });

    configTest('should resolve group permissions', async () => {
      const userPermissions = ['group:admin'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['article:read', 'article:write', 'user:read']);
    });

    configTest('should handle disabled permissions', async () => {
      const userPermissions = ['group:admin', 'no:article:write'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['article:read', 'user:read']);
      expect(resolved).not.toContain('article:write');
    });

    configTest('should handle disabled group permissions', async () => {
      const userPermissions = ['group:admin', 'no:group:admin'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual([]);
    });

    configTest('should handle mixed permissions', async () => {
      const userPermissions = ['article:read', 'group:admin', 'no:user:read', 'draft:write'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toContain('article:read');
      expect(resolved).toContain('article:write');
      expect(resolved).toContain('draft:write');
      expect(resolved).not.toContain('user:read');
    });
  });

  describe('hasPermissions', () => {
    beforeEach(() => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue([
        'article:read',
        'article:write',
        'user:read',
      ]);
    });

    configTest('should return true when user has all required permissions', async () => {
      const result = await service.hasPermissions(['group:admin'], ['article:read', 'user:read']);

      expect(result).toBe(true);
    });

    configTest('should return false when user lacks some permissions', async () => {
      const result = await service.hasPermissions(['group:admin'], ['article:read', 'user:delete']);

      expect(result).toBe(false);
    });

    configTest('should return true when user has "all" permission', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['all']);

      const result = await service.hasPermissions(['all'], ['article:read', 'user:delete']);

      expect(result).toBe(true);
    });
  });

  describe('createPermissionNode', () => {
    configTest('should create a permission node', async () => {
      const createDto = {
        name: 'article:read',
        description: 'Read articles',
        module: 'article',
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnThis() as () => MockQueryBuilder,
        returning: vi.fn().mockResolvedValue([mockPermissionNode]) as () => Promise<unknown[]>,
      });

      const result = await service.createPermissionNode(createDto);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(mockPermissionNode);
    });
  });

  describe('findAllPermissionNodes', () => {
    configTest('should find all permission nodes with pagination', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([mockPermissionNode]),
      });

      const query = { page: 1, limit: 10 };
      const result = await service.findAllPermissionNodes(query);

      expect(result).toEqual([mockPermissionNode]);
    });

    configTest('should filter by module', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([mockPermissionNode]),
      });

      const query = { module: 'article', page: 1, limit: 10 };
      const result = await service.findAllPermissionNodes(query);

      expect(result).toEqual([
        {
          ...mockPermissionNode,
          createdAt: dayjs('2025-08-08T06:36:15.292Z'),
          updatedAt: dayjs('2025-08-08T06:36:15.292Z'),
        },
      ]);
    });
  });

  describe('createPermissionGroup', () => {
    configTest('should create a permission group', async () => {
      const createDto = {
        name: 'admin',
        description: 'Administrator group',
        permissions: JSON.stringify(['article:read', 'article:write']),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnThis() as () => MockQueryBuilder,
        returning: vi.fn().mockResolvedValue([mockPermissionGroup]) as () => Promise<unknown[]>,
      });

      const result = await service.createPermissionGroup(createDto);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.permissions).toEqual(['article:read', 'article:write']);
    });
  });

  describe('initializePermissions', () => {
    configTest('should initialize all permissions and groups', async () => {
      // Mock registerModulePermissions
      vi.spyOn(
        service as unknown as { registerModulePermissions: () => Promise<void> },
        'registerModulePermissions',
      ).mockResolvedValue(undefined);
      // Mock createPredefinedGroups
      vi.spyOn(
        service as unknown as { createPredefinedGroups: () => Promise<void> },
        'createPredefinedGroups',
      ).mockResolvedValue(undefined);

      await service.initializePermissions();

      expect(service['registerModulePermissions']).toHaveBeenCalled();
      expect(service['createPredefinedGroups']).toHaveBeenCalled();
    });
  });

  describe('PERMISSION_MODULES and PERMISSION_GROUPS', () => {
    configTest('should have valid permission modules structure', () => {
      expect(PERMISSION_MODULES).toBeDefined();
      expect(PERMISSION_MODULES.article).toContain('article:read');
      expect(PERMISSION_MODULES.article).toContain('article:create');
      expect(PERMISSION_MODULES.user).toContain('user:read');
    });

    configTest('should have valid permission groups structure', () => {
      expect(PERMISSION_GROUPS).toBeDefined();
      expect(PERMISSION_GROUPS.admin).toBeDefined();
      expect(PERMISSION_GROUPS.editor).toBeDefined();
      expect(PERMISSION_GROUPS.author).toBeDefined();
      expect(PERMISSION_GROUPS.viewer).toBeDefined();
    });

    configTest('should have admin group with all permissions', () => {
      const allPermissions = Object.values(PERMISSION_MODULES).flat();
      expect(PERMISSION_GROUPS.admin).toEqual(allPermissions);
    });
  });
});
