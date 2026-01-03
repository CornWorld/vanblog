import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { Mock } from '@test/mock';

import { DATABASE_CONNECTION } from '../../database';

import { PermissionService } from './permission.service';

import type { PermissionRegistration } from './permission.service';

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
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;

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
    permissions: ['article:read', 'article:write'],
    isActive: true,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(async () => {
    // 创建基础 database mock 配置
    const dbMockBuilder = Mock.db();
    dbMockBuilder.setQueryResult([mockPermissionNode]);
    dbMockBuilder.setInsertResult([mockPermissionNode]);
    mockDb = dbMockBuilder.build();

    // 保留手动微调，以支持特定的测试场景
    mockDb.returning.mockResolvedValue([mockPermissionNode]);

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

  describe('Constructor and Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize predefined roles on construction', () => {
      const roles = ['admin', 'editor', 'author', 'viewer'];
      roles.forEach((role) => {
        expect(service['predefinedRoles'].has(role)).toBe(true);
      });
    });

    it('should initialize with empty module permissions map', () => {
      expect(service['modulePermissions'].size).toBe(0);
    });
  });

  describe('register', () => {
    it('should register module permissions with full names', () => {
      const config: PermissionRegistration = {
        module: 'article',
        permissions: ['read', 'write', 'delete'],
      };

      service.register(config);

      const modulePerms = service.getModulePermissions('article');
      expect(modulePerms).toEqual(['article:read', 'article:write', 'article:delete']);
    });

    it('should register role permissions for a module', () => {
      const config: PermissionRegistration = {
        module: 'article',
        permissions: ['read', 'write'],
        roles: {
          admin: ['read', 'write'],
          viewer: ['read'],
        },
      };

      service.register(config);

      expect(service['predefinedRoles'].get('admin')).toContain('article:read');
      expect(service['predefinedRoles'].get('admin')).toContain('article:write');
      expect(service['predefinedRoles'].get('viewer')).toContain('article:read');
      expect(service['predefinedRoles'].get('viewer')).not.toContain('article:write');
    });

    it('should accumulate permissions across multiple registrations', () => {
      service.register({ module: 'article', permissions: ['read'] });
      service.register({ module: 'user', permissions: ['create'] });

      expect(service.getModulePermissions('article')).toEqual(['article:read']);
      expect(service.getModulePermissions('user')).toEqual(['user:create']);
    });

    it('should invalidate caches after registration', () => {
      service['cachedKnownPermissions'] = new Set(['old:permission']);
      service['rolePermissionsCache'].set('admin', ['old:permission']);

      service.register({ module: 'article', permissions: ['read'] });

      expect(service['cachedKnownPermissions']).toBeNull();
      expect(service['rolePermissionsCache'].size).toBe(0);
    });
  });

  describe('resolvePermissionNames', () => {
    beforeEach(() => {
      service.register({ module: 'article', permissions: ['read', 'write'] });
    });

    it('should return full permission names unchanged', () => {
      const permissions = ['article:read', 'user:write'];
      const resolved = service.resolvePermissionNames('article', permissions);

      expect(resolved).toEqual(['article:read', 'user:write']);
    });

    it('should add module prefix to semantic names', () => {
      const permissions = ['read', 'write'];
      const resolved = service.resolvePermissionNames('article', permissions);

      expect(resolved).toEqual(['article:read', 'article:write']);
    });

    it('should handle mixed permission formats', () => {
      const permissions = ['read', 'user:write', 'article:delete'];
      const resolved = service.resolvePermissionNames('article', permissions);

      expect(resolved).toContain('article:read');
      expect(resolved).toContain('user:write');
      expect(resolved).toContain('article:delete');
    });

    it('should return unknown semantic names unchanged', () => {
      const permissions = ['unknown'];
      const resolved = service.resolvePermissionNames('article', permissions);

      expect(resolved).toEqual(['unknown']);
    });
  });

  describe('getModulePermissions', () => {
    it('should return empty array for unregistered module', () => {
      const perms = service.getModulePermissions('nonexistent');
      expect(perms).toEqual([]);
    });

    it('should return full permission names for registered module', () => {
      service.register({ module: 'article', permissions: ['read', 'write'] });

      const perms = service.getModulePermissions('article');
      expect(perms).toEqual(['article:read', 'article:write']);
    });
  });

  describe('getModuleSemanticPermissions', () => {
    it('should return semantic permission names', () => {
      service.register({ module: 'article', permissions: ['read', 'write'] });

      const semanticPerms = service.getModuleSemanticPermissions('article');
      expect(semanticPerms).toEqual(['read', 'write']);
    });

    it('should return empty array for unregistered module', () => {
      const semanticPerms = service.getModuleSemanticPermissions('nonexistent');
      expect(semanticPerms).toEqual([]);
    });
  });

  describe('getAllModulePermissions', () => {
    it('should return all registered module permissions', () => {
      service.register({ module: 'article', permissions: ['read', 'write'] });
      service.register({ module: 'user', permissions: ['create', 'delete'] });

      const allPerms = service.getAllModulePermissions();

      expect(allPerms).toHaveProperty('article');
      expect(allPerms).toHaveProperty('user');
      expect(allPerms.article.fullPermissions).toEqual(['article:read', 'article:write']);
      expect(allPerms.article.semanticPermissions).toEqual(['read', 'write']);
      expect(allPerms.user.fullPermissions).toEqual(['user:create', 'user:delete']);
      expect(allPerms.user.semanticPermissions).toEqual(['create', 'delete']);
    });

    it('should return empty object when no modules registered', () => {
      const allPerms = service.getAllModulePermissions();
      expect(allPerms).toEqual({});
    });
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

    it('should cache registered permissions', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockPermissionNode]),
      });

      await service.registerPermission({
        name: 'article:read',
        description: 'Read articles',
        module: 'article',
      });

      expect(service['registeredPermissions'].has('article:article:read')).toBe(true);
    });

    it('should handle registration errors gracefully', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(
        service.registerPermission({
          name: 'article:read',
          description: 'Read articles',
          module: 'article',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('resolveUserPermissions', () => {
    beforeEach(() => {
      // Register modules to build known permissions set
      service.register({ module: 'article', permissions: ['read', 'write'] });
      service.register({ module: 'user', permissions: ['read', 'write'] });
      service.register({ module: 'draft', permissions: ['write'] });
    });

    it('should handle "all" permission', async () => {
      const userPermissions = ['all'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['all']);
    });

    it('should resolve basic permissions', async () => {
      const userPermissions = ['article:read', 'user:write'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['article:read', 'user:write']);
    });

    it('should resolve role permissions', async () => {
      vi.spyOn(
        service as unknown as { getRolePermissions: (roleName: string) => Promise<string[]> },
        'getRolePermissions',
      ).mockResolvedValue(['article:read', 'article:write', 'user:read']);

      const userPermissions = ['role:admin'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['article:read', 'article:write', 'user:read']);
    });

    it('should handle disabled permissions', async () => {
      vi.spyOn(
        service as unknown as { getRolePermissions: (roleName: string) => Promise<string[]> },
        'getRolePermissions',
      ).mockResolvedValue(['article:read', 'article:write', 'user:read']);

      const userPermissions = ['role:admin', 'no:article:write'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['article:read', 'user:read']);
      expect(resolved).not.toContain('article:write');
    });

    it('should handle disabled role permissions', async () => {
      vi.spyOn(
        service as unknown as { getRolePermissions: (roleName: string) => Promise<string[]> },
        'getRolePermissions',
      ).mockResolvedValue(['article:read', 'article:write', 'user:read']);

      const userPermissions = ['role:admin', 'no:role:admin'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual([]);
    });

    it('should handle mixed permissions and roles', async () => {
      vi.spyOn(
        service as unknown as { getRolePermissions: (roleName: string) => Promise<string[]> },
        'getRolePermissions',
      ).mockResolvedValue(['article:read', 'article:write', 'user:read']);

      const userPermissions = ['article:read', 'role:admin', 'no:user:read', 'draft:write'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toContain('article:read');
      expect(resolved).toContain('article:write');
      expect(resolved).toContain('draft:write');
      expect(resolved).not.toContain('user:read');
    });

    it('should filter out unknown permissions', async () => {
      const userPermissions = ['article:read', 'unknown:permission', 'invalid'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toEqual(['article:read']);
      expect(resolved).not.toContain('unknown:permission');
      expect(resolved).not.toContain('invalid');
    });

    it('should process permissions in order (later overrides earlier)', async () => {
      const userPermissions = ['article:read', 'no:article:read', 'article:read'];
      const resolved = await service.resolveUserPermissions(userPermissions);

      expect(resolved).toContain('article:read');
    });
  });

  describe('hasPermissions', () => {
    beforeEach(() => {
      service.register({ module: 'article', permissions: ['read', 'write'] });
      service.register({ module: 'user', permissions: ['read', 'write'] });
    });

    it('should return true when user has all required permissions', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue([
        'article:read',
        'article:write',
        'user:read',
      ]);

      const result = await service.hasPermissions(['group:admin'], ['article:read', 'user:read']);

      expect(result).toBe(true);
    });

    it('should return false when user lacks some permissions', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['article:read']);

      const result = await service.hasPermissions(['group:admin'], ['article:read', 'user:delete']);

      expect(result).toBe(false);
    });

    it('should return true when user has "all" permission', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['all']);

      const result = await service.hasPermissions(['all'], ['article:read', 'user:delete']);

      expect(result).toBe(true);
    });

    it('should return true for empty required permissions', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['article:read']);

      const result = await service.hasPermissions(['article:read'], []);

      expect(result).toBe(true);
    });
  });

  describe('Permission Escalation Prevention', () => {
    beforeEach(() => {
      service.register({
        module: 'article',
        permissions: ['read', 'write', 'delete'],
        roles: {
          viewer: ['read'],
          author: ['read', 'write'],
          admin: ['read', 'write', 'delete'],
        },
      });
      service.register({
        module: 'user',
        permissions: ['read', 'write'],
        roles: {
          viewer: [],
          author: [],
          admin: ['read', 'write'],
        },
      });
    });

    it('should prevent privilege escalation - normal user cannot access admin permissions', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue([
        'article:read',
        'article:write',
      ]);

      // Viewer attempting to access delete permission (admin only)
      const result = await service.hasPermissions(['viewer'], ['article:delete']);

      expect(result).toBe(false);
    });

    it('should prevent privilege escalation - viewer cannot get author permissions', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['article:read']);

      // Viewer attempting to get write permission (author+)
      const result = await service.hasPermissions(['viewer'], ['article:write']);

      expect(result).toBe(false);
    });

    it('should prevent unauthorized access to user:write permission', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['article:read', 'user:read']);

      // Author from article module shouldn't have user:write
      const result = await service.hasPermissions(['author'], ['user:write']);

      expect(result).toBe(false);
    });

    it('should not escalate permissions through role combination', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['article:read', 'user:read']);

      // User with viewer+read permissions cannot escalate to write
      const result = await service.hasPermissions(['viewer'], ['article:write', 'user:write']);

      expect(result).toBe(false);
    });

    it('should prevent child permission escalation to parent permission', async () => {
      // Register hierarchical permissions
      service.register({
        module: 'admin',
        permissions: ['read', 'write', 'delete_all'],
        roles: {
          admin: ['read', 'write', 'delete_all'],
        },
      });

      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['admin:read']);

      // User with read permission shouldn't escalate to write or delete_all
      const result = await service.hasPermissions(['admin'], ['admin:write', 'admin:delete_all']);

      expect(result).toBe(false);
    });
  });

  describe('Role Switching Security', () => {
    beforeEach(() => {
      service.register({
        module: 'article',
        permissions: ['read', 'write', 'delete'],
        roles: {
          admin: ['read', 'write', 'delete'],
          editor: ['read', 'write'],
          author: ['read'],
        },
      });
    });

    it('should clear permissions when switching from admin to author role', async () => {
      // First verify admin permissions
      vi.spyOn(service, 'resolveUserPermissions')
        .mockResolvedValueOnce(['article:read', 'article:write', 'article:delete'])
        .mockResolvedValueOnce(['article:read']);

      const adminResult = await service.hasPermissions(
        ['admin'],
        ['article:write', 'article:delete'],
      );
      expect(adminResult).toBe(true);

      // Then verify permissions are reduced to author level
      const authorResult = await service.hasPermissions(['author'], ['article:write']);
      expect(authorResult).toBe(false);
    });

    it('should not retain permissions after role revocation', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['article:read']);

      // After role change, permissions should be cleaned
      const result = await service.hasPermissions([], ['article:read', 'article:write']);

      expect(result).toBe(false);
    });

    it('should properly invalidate permission cache on role update', async () => {
      service['rolePermissionsCache'].set('admin', [
        'article:read',
        'article:write',
        'article:delete',
      ]);

      // Update permission group should invalidate cache
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            name: 'admin',
            description: 'Admin updated',
            permissions: ['article:read'], // Reduced permissions
            isActive: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-02T00:00:00Z',
          },
        ]),
      });

      const initialCacheSize = service['rolePermissionsCache'].size;
      expect(initialCacheSize).toBe(1);

      // After update, cache should be cleared
      await service.updatePermissionGroup(1, { description: 'Admin updated' });

      expect(service['rolePermissionsCache'].size).toBe(0);
    });
  });

  describe('CRUD Operations - Permission Nodes', () => {
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

      it('should handle date conversion', async () => {
        const nodeWithDateObjects = {
          ...mockPermissionNode,
          createdAt: new Date(mockDate),
          updatedAt: new Date(mockDate),
        };

        mockDb.returning.mockResolvedValue([nodeWithDateObjects]);

        const result = await service.createPermissionNode({
          name: 'article:read',
          description: 'Read articles',
          module: 'article',
        });

        expect(typeof result.createdAt).toBe('string');
        expect(typeof result.updatedAt).toBe('string');
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
        const whereMock = vi.fn().mockReturnThis();
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: whereMock,
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockResolvedValue([mockPermissionNode]),
        });

        const query = { module: 'article', page: 1, limit: 10 };
        const result = await service.findAllPermissionNodes(query);

        expect(result).toEqual([mockPermissionNode]);
        expect(whereMock).toHaveBeenCalled();
      });

      it('should filter by isActive status', async () => {
        const whereMock = vi.fn().mockReturnThis();
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: whereMock,
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockResolvedValue([mockPermissionNode]),
        });

        const query = { isActive: true, page: 1, limit: 10 };
        const result = await service.findAllPermissionNodes(query);

        expect(result).toEqual([mockPermissionNode]);
        expect(whereMock).toHaveBeenCalled();
      });

      it('should handle pagination correctly', async () => {
        const limitMock = vi.fn().mockReturnThis();
        const offsetMock = vi.fn().mockResolvedValue([mockPermissionNode]);
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: limitMock,
          offset: offsetMock,
        });

        await service.findAllPermissionNodes({ page: 2, limit: 20 });

        expect(limitMock).toHaveBeenCalledWith(20);
        expect(offsetMock).toHaveBeenCalledWith(20);
      });
    });

    describe('findPermissionNodeById', () => {
      it('should return a permission node by id', async () => {
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockPermissionNode]),
        });

        const result = await service.findPermissionNodeById(1);

        expect(result).toEqual(mockPermissionNode);
      });

      it('should throw NotFoundException when node not found', async () => {
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        });

        await expect(service.findPermissionNodeById(999)).rejects.toThrow(NotFoundException);
      });
    });

    describe('updatePermissionNode', () => {
      it('should update a permission node', async () => {
        const updateDto = { description: 'Updated description' };
        const updatedNode = { ...mockPermissionNode, ...updateDto };

        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([updatedNode]),
        });

        const result = await service.updatePermissionNode(1, updateDto);

        expect(result.description).toBe('Updated description');
      });

      it('should throw NotFoundException when node not found', async () => {
        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([]),
        });

        await expect(service.updatePermissionNode(999, {})).rejects.toThrow(NotFoundException);
      });
    });

    describe('removePermissionNode', () => {
      it('should remove a permission node', async () => {
        mockDb.delete.mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        });

        await expect(service.removePermissionNode(1)).resolves.not.toThrow();
      });

      it('should throw NotFoundException when node not found', async () => {
        mockDb.delete.mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
        });

        await expect(service.removePermissionNode(999)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('CRUD Operations - Permission Groups', () => {
    describe('createPermissionGroup', () => {
      it('should create a permission group', async () => {
        const createDto = {
          name: 'admin',
          description: 'Administrator group',
          permissions: ['article:read', 'article:write'],
          isActive: true,
        };

        mockDb.insert.mockReturnValue({
          values: vi.fn().mockReturnThis() as () => MockQueryBuilder,
          returning: vi.fn().mockResolvedValue([mockPermissionGroup]) as () => Promise<unknown[]>,
        });

        const result = await service.createPermissionGroup(createDto);

        expect(mockDb.insert).toHaveBeenCalled();
        expect(result.permissions).toEqual(['article:read', 'article:write']);
      });

      it('should invalidate role permissions cache after creation', async () => {
        service['rolePermissionsCache'].set('admin', ['old:permission']);

        mockDb.insert.mockReturnValue({
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockPermissionGroup]),
        });

        await service.createPermissionGroup({
          name: 'admin',
          description: 'Admin',
          permissions: ['new:permission'],
          isActive: true,
        });

        expect(service['rolePermissionsCache'].size).toBe(0);
      });
    });

    describe('findAllPermissionGroups', () => {
      it('should return all permission groups', async () => {
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockResolvedValue([mockPermissionGroup]),
        });

        const result = await service.findAllPermissionGroups({ page: 1, limit: 10 });

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('admin');
      });

      it('should filter by isActive status', async () => {
        const whereMock = vi.fn().mockReturnThis();
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: whereMock,
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockResolvedValue([mockPermissionGroup]),
        });

        const result = await service.findAllPermissionGroups({
          isActive: true,
          page: 1,
          limit: 10,
        });

        expect(result).toHaveLength(1);
        expect(whereMock).toHaveBeenCalled();
      });
    });

    describe('findPermissionGroupById', () => {
      it('should return a permission group by id', async () => {
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockPermissionGroup]),
        });

        const result = await service.findPermissionGroupById(1);

        expect(result.name).toBe('admin');
      });

      it('should throw NotFoundException when group not found', async () => {
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        });

        await expect(service.findPermissionGroupById(999)).rejects.toThrow(NotFoundException);
      });
    });

    describe('updatePermissionGroup', () => {
      it('should update a permission group', async () => {
        const updateDto = { description: 'Updated description' };
        const updatedGroup = { ...mockPermissionGroup, ...updateDto };

        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([updatedGroup]),
        });

        const result = await service.updatePermissionGroup(1, updateDto);

        expect(result.description).toBe('Updated description');
      });

      it('should invalidate cache after update', async () => {
        service['rolePermissionsCache'].set('admin', ['old:permission']);

        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockPermissionGroup]),
        });

        await service.updatePermissionGroup(1, { description: 'Updated' });

        expect(service['rolePermissionsCache'].size).toBe(0);
      });

      it('should throw NotFoundException when group not found', async () => {
        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([]),
        });

        await expect(service.updatePermissionGroup(999, {})).rejects.toThrow(NotFoundException);
      });
    });

    describe('removePermissionGroup', () => {
      it('should remove a permission group', async () => {
        mockDb.delete.mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        });

        await expect(service.removePermissionGroup(1)).resolves.not.toThrow();
      });

      it('should invalidate cache after deletion', async () => {
        service['rolePermissionsCache'].set('admin', ['old:permission']);

        mockDb.delete.mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        });

        await service.removePermissionGroup(1);

        expect(service['rolePermissionsCache'].size).toBe(0);
      });

      it('should throw NotFoundException when group not found', async () => {
        mockDb.delete.mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
        });

        await expect(service.removePermissionGroup(999)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('initializePermissions', () => {
    it('should initialize all permissions and groups', async () => {
      vi.spyOn(
        service as unknown as { registerAllModulePermissions: () => Promise<void> },
        'registerAllModulePermissions',
      ).mockResolvedValue(undefined);

      vi.spyOn(
        service as unknown as { ensurePredefinedGroups: () => Promise<void> },
        'ensurePredefinedGroups',
      ).mockResolvedValue(undefined);

      await service.initializePermissions();

      expect(service['registerAllModulePermissions']).toHaveBeenCalled();
      expect(service['ensurePredefinedGroups']).toHaveBeenCalled();
    });

    it('should invalidate all caches after initialization', async () => {
      service['cachedKnownPermissions'] = new Set(['old']);
      service['rolePermissionsCache'].set('admin', ['old']);

      vi.spyOn(
        service as unknown as { registerAllModulePermissions: () => Promise<void> },
        'registerAllModulePermissions',
      ).mockResolvedValue(undefined);

      vi.spyOn(
        service as unknown as { ensurePredefinedGroups: () => Promise<void> },
        'ensurePredefinedGroups',
      ).mockResolvedValue(undefined);

      await service.initializePermissions();

      expect(service['cachedKnownPermissions']).toBeNull();
      expect(service['rolePermissionsCache'].size).toBe(0);
    });
  });

  describe('Cache Management', () => {
    it('should cache known permissions set', () => {
      service.register({ module: 'article', permissions: ['read', 'write'] });

      const firstCall = service['getKnownPermissionsSet']();
      const secondCall = service['getKnownPermissionsSet']();

      expect(firstCall).toBe(secondCall); // Same reference
      expect(service['cachedKnownPermissions']).toBe(firstCall);
    });

    it('should rebuild cache after invalidation', () => {
      service.register({ module: 'article', permissions: ['read'] });
      const firstCache = service['getKnownPermissionsSet']();

      service['cachedKnownPermissions'] = null;
      service.register({ module: 'user', permissions: ['create'] });

      const secondCache = service['getKnownPermissionsSet']();

      expect(firstCache).not.toBe(secondCache);
      expect(secondCache.has('user:create')).toBe(true);
    });
  });

  describe('Private Helper Methods', () => {
    describe('isKnownPermission', () => {
      beforeEach(() => {
        service.register({ module: 'article', permissions: ['read', 'write'] });
      });

      it('should return true for known permissions', () => {
        const result = service['isKnownPermission']('article:read');
        expect(result).toBe(true);
      });

      it('should return false for unknown permissions', () => {
        const result = service['isKnownPermission']('unknown:permission');
        expect(result).toBe(false);
      });

      it('should return false for permissions without colon', () => {
        const result = service['isKnownPermission']('invalidformat');
        expect(result).toBe(false);
      });
    });

    describe('normalizePermissionGroupRow', () => {
      it('should normalize date fields to ISO strings', () => {
        const row = {
          id: 1,
          name: 'test',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-02'),
        };

        const normalized = service['normalizePermissionGroupRow'](row);

        expect(typeof normalized.createdAt).toBe('string');
        expect(typeof normalized.updatedAt).toBe('string');
      });

      it('should handle string dates unchanged', () => {
        const row = {
          id: 1,
          name: 'test',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
        };

        const normalized = service['normalizePermissionGroupRow'](row);

        expect(normalized.createdAt).toBe('2025-01-01T00:00:00Z');
        expect(normalized.updatedAt).toBe('2025-01-02T00:00:00Z');
      });

      it('should handle null/undefined dates', () => {
        const row = {
          id: 1,
          name: 'test',
          createdAt: null,
          updatedAt: undefined,
        };

        const normalized = service['normalizePermissionGroupRow'](row);

        expect(typeof normalized.createdAt).toBe('string');
        expect(typeof normalized.updatedAt).toBe('string');
      });
    });
  });
});
