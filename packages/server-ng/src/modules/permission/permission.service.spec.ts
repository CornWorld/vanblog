import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';

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

describe('PermissionService', () => {
  let service: PermissionService;
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    offset: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  const mockDate = '2025-08-08T06:36:15+00:00';
  const mockPermissionNode = {
    id: 1,
    name: 'article:read',
    description: 'Read articles',
    module: 'article',
    isActive: true,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  const mockPermissionGroup = {
    id: 1,
    name: 'admin',
    description: 'Administrator group',
    permissions: JSON.stringify(['article:read', 'article:write']),
    isActive: true,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(async () => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockPermissionNode]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
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

  describe('registerPermission', () => {
    it('should register a new permission node', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      await service.registerPermission({
        name: 'article:read',
        description: 'Read articles',
        module: 'article',
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should not register existing permission node', async () => {
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
      // Mock getRolePermissions method
      vi.spyOn(
        service as unknown as { getRolePermissions: (roleName: string) => Promise<string[]> },
        'getRolePermissions',
      ).mockResolvedValue(['article:read', 'article:write', 'user:read']);

      // 注册模块权限以构建已知权限集合，避免被过滤掉
      service.register({ module: 'article', permissions: ['read', 'write'] });
      service.register({ module: 'user', permissions: ['read', 'write'] });
      service.register({ module: 'draft', permissions: ['write'] });
    });

    it('should resolve basic permissions', async () => {
      const userPermissions = ['article:read', 'user:write'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['article:read', 'user:write']);
    });

    it('should resolve role permissions', async () => {
      const userPermissions = ['role:admin'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['article:read', 'article:write', 'user:read']);
    });

    it('should handle disabled permissions', async () => {
      const userPermissions = ['role:admin', 'no:article:write'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['article:read', 'user:read']);
      expect(resolved).not.toContain('article:write');
    });

    it('should handle disabled role permissions', async () => {
      const userPermissions = ['role:admin', 'no:role:admin'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual([]);
    });

    it('should handle mixed permissions', async () => {
      const userPermissions = ['article:read', 'role:admin', 'no:user:read', 'draft:write'];
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

    it('should return true when user has all required permissions', async () => {
      const result = await service.hasPermissions(['group:admin'], ['article:read', 'user:read']);

      expect(result).toBe(true);
    });

    it('should return false when user lacks some permissions', async () => {
      const result = await service.hasPermissions(['group:admin'], ['article:read', 'user:delete']);

      expect(result).toBe(false);
    });

    it('should return true when user has "all" permission', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['all']);

      const result = await service.hasPermissions(['all'], ['article:read', 'user:delete']);

      expect(result).toBe(true);
    });
  });

  describe('createPermissionNode', () => {
    it('should create a permission node', async () => {
      const createDto = {
        name: 'article:read',
        description: 'Read articles',
        module: 'article',
      };

      const result = await service.createPermissionNode(createDto);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(mockPermissionNode);
    });
  });

  describe('findAllPermissionNodes', () => {
    it('should find all permission nodes with pagination', async () => {
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

    it('should filter by module', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([mockPermissionNode]),
      });

      const query = { module: 'article', page: 1, limit: 10 };
      const result = await service.findAllPermissionNodes(query);

      expect(result).toEqual([mockPermissionNode]);
    });
  });

  describe('createPermissionGroup', () => {
    it('should create a permission group', async () => {
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
    it('should initialize all permissions and groups', async () => {
      // Mock registerAllModulePermissions
      vi.spyOn(
        service as unknown as { registerAllModulePermissions: () => Promise<void> },
        'registerAllModulePermissions',
      ).mockResolvedValue(undefined);
      // Mock ensurePredefinedGroups
      vi.spyOn(
        service as unknown as { ensurePredefinedGroups: () => Promise<void> },
        'ensurePredefinedGroups',
      ).mockResolvedValue(undefined);

      await service.initializePermissions();

      expect(service['registerAllModulePermissions']).toHaveBeenCalled();
      expect(service['ensurePredefinedGroups']).toHaveBeenCalled();
    });
  });
});
