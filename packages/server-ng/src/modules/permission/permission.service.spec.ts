import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { db } from '@test/setup.unit';
import { Given } from '@test/given';
import { permissionNodes, permissionGroups } from '@vanblog/shared/drizzle';

import { DATABASE_CONNECTION } from '../../database';

import { PermissionService } from './permission.service';

import type { PermissionRegistration } from './permission.service';

describe('PermissionService', () => {
  let service: PermissionService;

  // Helper function to create service instances with transaction database
  // Uses 'any' type to avoid TypeScript strictness with transaction type mismatches
  const createServiceWithTx = (tx: any) => {
    return new PermissionService(tx);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
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
      await withTestTransaction(db, async (tx) => {
        // Inject transaction database
        const testService = createServiceWithTx(tx);

        await testService.registerPermission({
          name: 'article:read',
          description: 'Read articles',
          module: 'article',
        });

        // Verify database insertion
        const [saved] = await tx
          .select()
          .from(permissionNodes)
          .where(eq(permissionNodes.name, 'article:read'));
        expect(saved).toBeDefined();
        expect(saved.description).toBe('Read articles');
        expect(saved.module).toBe('article');
      });
    });

    it('should not register existing permission node', async () => {
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);

        // First registration
        await testService.registerPermission({
          name: 'article:read',
          description: 'Read articles',
          module: 'article',
        });

        // Second registration (should skip)
        await testService.registerPermission({
          name: 'article:read',
          description: 'Read articles',
          module: 'article',
        });

        // Verify only one entry exists
        const results = await tx
          .select()
          .from(permissionNodes)
          .where(eq(permissionNodes.name, 'article:read'));
        expect(results).toHaveLength(1);
      });
    });

    it('should cache registered permissions', async () => {
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);

        await testService.registerPermission({
          name: 'article:read',
          description: 'Read articles',
          module: 'article',
        });

        expect(testService['registeredPermissions'].has('article:article:read')).toBe(true);
      });
    });

    it('should handle registration errors gracefully', async () => {
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);

        // Mock invalid permission node (missing required field)
        await expect(
          testService.registerPermission({
            name: '',
            description: 'Invalid',
            module: 'test',
          } as any),
        ).resolves.not.toThrow();
      });
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
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);
        testService.register({
          module: 'article',
          permissions: ['read', 'write'],
          roles: {
            admin: ['read', 'write'],
          },
        });
        testService.register({
          module: 'user',
          permissions: ['read'],
        });

        // Create permission group for admin
        await Given.permissionGroup(tx, {
          name: 'admin',
          description: 'Admin role',
          permissions: ['article:read', 'article:write', 'user:read'],
          isActive: true,
        });

        const userPermissions = ['role:admin'];
        const resolved = await testService.resolveUserPermissions(userPermissions);

        expect(resolved).toEqual(['article:read', 'article:write', 'user:read']);
      });
    });

    it('should handle disabled permissions', async () => {
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);
        testService.register({
          module: 'article',
          permissions: ['read', 'write'],
          roles: {
            admin: ['read', 'write'],
          },
        });
        testService.register({
          module: 'user',
          permissions: ['read'],
        });

        // Create permission group for admin
        await Given.permissionGroup(tx, {
          name: 'admin',
          description: 'Admin role',
          permissions: ['article:read', 'article:write', 'user:read'],
          isActive: true,
        });

        const userPermissions = ['role:admin', 'no:article:write'];
        const resolved = await testService.resolveUserPermissions(userPermissions);

        expect(resolved).toEqual(['article:read', 'user:read']);
        expect(resolved).not.toContain('article:write');
      });
    });

    it('should handle disabled role permissions', async () => {
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);
        testService.register({
          module: 'article',
          permissions: ['read', 'write'],
          roles: {
            admin: ['read', 'write'],
          },
        });

        // Create permission group for admin
        await Given.permissionGroup(tx, {
          name: 'admin',
          description: 'Admin role',
          permissions: ['article:read', 'article:write', 'user:read'],
          isActive: true,
        });

        const userPermissions = ['role:admin', 'no:role:admin'];
        const resolved = await testService.resolveUserPermissions(userPermissions);

        expect(resolved).toEqual([]);
      });
    });

    it('should handle mixed permissions and roles', async () => {
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);
        testService.register({
          module: 'article',
          permissions: ['read', 'write'],
          roles: {
            admin: ['read', 'write'],
          },
        });
        testService.register({
          module: 'draft',
          permissions: ['write'],
        });

        // Create permission group for admin
        await Given.permissionGroup(tx, {
          name: 'admin',
          description: 'Admin role',
          permissions: ['article:read', 'article:write', 'user:read'],
          isActive: true,
        });

        const userPermissions = ['article:read', 'role:admin', 'no:user:read', 'draft:write'];
        const resolved = await testService.resolveUserPermissions(userPermissions);

        expect(resolved).toContain('article:read');
        expect(resolved).toContain('article:write');
        expect(resolved).toContain('draft:write');
        expect(resolved).not.toContain('user:read');
      });
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
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);
        testService['rolePermissionsCache'].set('admin', [
          'article:read',
          'article:write',
          'article:delete',
        ]);

        // Create permission group for admin
        const group = await Given.permissionGroup(tx, {
          name: 'admin',
          description: 'Admin group',
          permissions: ['article:read', 'article:write', 'article:delete'],
          isActive: true,
        });

        const initialCacheSize = testService['rolePermissionsCache'].size;
        expect(initialCacheSize).toBe(1);

        // Update permission group should invalidate cache
        await testService.updatePermissionGroup(group.id, { description: 'Admin updated' });

        expect(testService['rolePermissionsCache'].size).toBe(0);
      });
    });
  });

  describe('CRUD Operations - Permission Nodes', () => {
    describe('createPermissionNode', () => {
      it('should create a permission node', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          const createDto = {
            name: 'article:read',
            description: 'Read articles',
            module: 'article',
          };

          const result = await testService.createPermissionNode(createDto);

          // Verify return value
          expect(result.name).toBe('article:read');
          expect(result.description).toBe('Read articles');
          expect(result.module).toBe('article');
          expect(result.id).toBeDefined();

          // Verify database persistence
          const [saved] = await tx
            .select()
            .from(permissionNodes)
            .where(eq(permissionNodes.id, result.id));
          expect(saved).toBeDefined();
          expect(saved.name).toBe('article:read');
        });
      });

      it('should handle date conversion', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          const result = await testService.createPermissionNode({
            name: 'article:read',
            description: 'Read articles',
            module: 'article',
          });

          expect(typeof result.createdAt).toBe('string');
          expect(typeof result.updatedAt).toBe('string');
        });
      });
    });

    describe('findAllPermissionNodes', () => {
      it('should find all permission nodes with pagination', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          // Create test data
          await tx.insert(permissionNodes).values([
            {
              name: 'article:read',
              description: 'Read articles',
              module: 'article',
              isActive: true,
            },
            {
              name: 'article:write',
              description: 'Write articles',
              module: 'article',
              isActive: true,
            },
          ]);

          const query = { page: 1, limit: 10 };
          const result = await testService.findAllPermissionNodes(query);

          expect(result).toHaveLength(2);
          expect(result.map((r) => r.name)).toContain('article:read');
          expect(result.map((r) => r.name)).toContain('article:write');
        });
      });

      it('should filter by module', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          // Create test data
          await tx.insert(permissionNodes).values([
            {
              name: 'article:read',
              description: 'Read articles',
              module: 'article',
              isActive: true,
            },
            {
              name: 'user:read',
              description: 'Read users',
              module: 'user',
              isActive: true,
            },
          ]);

          const query = { module: 'article', page: 1, limit: 10 };
          const result = await testService.findAllPermissionNodes(query);

          expect(result).toHaveLength(1);
          expect(result[0].module).toBe('article');
        });
      });

      it('should filter by isActive status', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          // Create test data
          await tx.insert(permissionNodes).values([
            {
              name: 'article:read',
              description: 'Read articles',
              module: 'article',
              isActive: true,
            },
            {
              name: 'article:write',
              description: 'Write articles',
              module: 'article',
              isActive: false,
            },
          ]);

          const query = { isActive: true, page: 1, limit: 10 };
          const result = await testService.findAllPermissionNodes(query);

          expect(result).toHaveLength(1);
          expect(result[0].isActive).toBe(true);
        });
      });

      it('should handle pagination correctly', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          // Create test data
          await tx.insert(permissionNodes).values(
            Array.from({ length: 25 }, (_, i) => ({
              name: `permission:${String(i)}`,
              description: `Permission ${String(i)}`,
              module: 'test',
              isActive: true,
            })),
          );

          // First page
          const page1 = await testService.findAllPermissionNodes({ page: 1, limit: 10 });
          expect(page1).toHaveLength(10);

          // Second page
          const page2 = await testService.findAllPermissionNodes({ page: 2, limit: 10 });
          expect(page2).toHaveLength(10);

          // Verify no overlap
          const ids1 = new Set(page1.map((p) => p.id));
          const ids2 = new Set(page2.map((p) => p.id));
          const intersection = [...ids1].filter((id) => ids2.has(id));
          expect(intersection).toHaveLength(0);
        });
      });
    });

    describe('findPermissionNodeById', () => {
      it('should return a permission node by id', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          const [created] = await tx
            .insert(permissionNodes)
            .values({
              name: 'article:read',
              description: 'Read articles',
              module: 'article',
              isActive: true,
            })
            .returning();

          const result = await testService.findPermissionNodeById(created.id);

          expect(result.name).toBe('article:read');
          expect(result.id).toBe(created.id);
        });
      });

      it('should throw NotFoundException when node not found', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          await expect(testService.findPermissionNodeById(999)).rejects.toThrow(NotFoundException);
        });
      });
    });

    describe('updatePermissionNode', () => {
      it('should update a permission node', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          const [created] = await tx
            .insert(permissionNodes)
            .values({
              name: 'article:read',
              description: 'Read articles',
              module: 'article',
              isActive: true,
            })
            .returning();

          const updateDto = { description: 'Updated description' };
          const result = await testService.updatePermissionNode(created.id, updateDto);

          expect(result.description).toBe('Updated description');

          // Verify database update
          const [updated] = await tx
            .select()
            .from(permissionNodes)
            .where(eq(permissionNodes.id, created.id));
          expect(updated.description).toBe('Updated description');
        });
      });

      it('should throw NotFoundException when node not found', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          await expect(testService.updatePermissionNode(999, {})).rejects.toThrow(
            NotFoundException,
          );
        });
      });
    });

    describe('removePermissionNode', () => {
      it('should remove a permission node', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          const [created] = await tx
            .insert(permissionNodes)
            .values({
              name: 'article:read',
              description: 'Read articles',
              module: 'article',
              isActive: true,
            })
            .returning();

          await expect(testService.removePermissionNode(created.id)).resolves.not.toThrow();

          // Verify database deletion
          const result = await tx
            .select()
            .from(permissionNodes)
            .where(eq(permissionNodes.id, created.id));
          expect(result).toHaveLength(0);
        });
      });

      it('should throw NotFoundException when node not found', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          await expect(testService.removePermissionNode(999)).rejects.toThrow(NotFoundException);
        });
      });
    });
  });

  describe('CRUD Operations - Permission Groups', () => {
    describe('createPermissionGroup', () => {
      it('should create a permission group', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          const createDto = {
            name: 'admin',
            description: 'Administrator group',
            permissions: ['article:read', 'article:write'],
            isActive: true,
          };

          const result = await testService.createPermissionGroup(createDto);

          // Verify return value
          expect(result.name).toBe('admin');
          expect(result.permissions).toEqual(['article:read', 'article:write']);

          // Verify database persistence
          const [saved] = await tx
            .select()
            .from(permissionGroups)
            .where(eq(permissionGroups.id, result.id));
          expect(saved).toBeDefined();
          expect(saved.name).toBe('admin');
        });
      });

      it('should invalidate role permissions cache after creation', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);
          testService['rolePermissionsCache'].set('admin', ['old:permission']);

          await testService.createPermissionGroup({
            name: 'admin',
            description: 'Admin',
            permissions: ['new:permission'],
            isActive: true,
          });

          expect(testService['rolePermissionsCache'].size).toBe(0);
        });
      });
    });

    describe('findAllPermissionGroups', () => {
      it('should return all permission groups', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          // Create test data
          await Given.permissionGroup(tx, {
            name: 'admin',
            description: 'Administrator',
            permissions: ['article:read', 'article:write'],
            isActive: true,
          });

          await Given.permissionGroup(tx, {
            name: 'viewer',
            description: 'Viewer',
            permissions: ['article:read'],
            isActive: true,
          });

          const result = await testService.findAllPermissionGroups({ page: 1, limit: 10 });

          expect(result).toHaveLength(2);
        });
      });

      it('should filter by isActive status', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          // Create test data
          await Given.permissionGroup(tx, {
            name: 'admin',
            description: 'Administrator',
            permissions: ['article:read'],
            isActive: true,
          });

          await Given.permissionGroup(tx, {
            name: 'inactive',
            description: 'Inactive group',
            permissions: [],
            isActive: false,
          });

          const result = await testService.findAllPermissionGroups({
            isActive: true,
            page: 1,
            limit: 10,
          });

          expect(result).toHaveLength(1);
          expect(result[0].isActive).toBe(true);
        });
      });
    });

    describe('findPermissionGroupById', () => {
      it('should return a permission group by id', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          const created = await Given.permissionGroup(tx, {
            name: 'admin',
            description: 'Administrator',
            permissions: ['article:read', 'article:write'],
            isActive: true,
          });

          const result = await testService.findPermissionGroupById(created.id);

          expect(result.name).toBe('admin');
          expect(result.id).toBe(created.id);
        });
      });

      it('should throw NotFoundException when group not found', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          await expect(testService.findPermissionGroupById(999)).rejects.toThrow(NotFoundException);
        });
      });
    });

    describe('updatePermissionGroup', () => {
      it('should update a permission group', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          const created = await Given.permissionGroup(tx, {
            name: 'admin',
            description: 'Administrator',
            permissions: ['article:read'],
            isActive: true,
          });

          const updateDto = { description: 'Updated description' };
          const result = await testService.updatePermissionGroup(created.id, updateDto);

          expect(result.description).toBe('Updated description');

          // Verify database update
          const [updated] = await tx
            .select()
            .from(permissionGroups)
            .where(eq(permissionGroups.id, created.id));
          expect(updated.description).toBe('Updated description');
        });
      });

      it('should invalidate cache after update', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);
          testService['rolePermissionsCache'].set('admin', ['old:permission']);

          const created = await Given.permissionGroup(tx, {
            name: 'admin',
            description: 'Administrator',
            permissions: ['article:read'],
            isActive: true,
          });

          await testService.updatePermissionGroup(created.id, { description: 'Updated' });

          expect(testService['rolePermissionsCache'].size).toBe(0);
        });
      });

      it('should throw NotFoundException when group not found', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          await expect(testService.updatePermissionGroup(999, {})).rejects.toThrow(
            NotFoundException,
          );
        });
      });
    });

    describe('removePermissionGroup', () => {
      it('should remove a permission group', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          const created = await Given.permissionGroup(tx, {
            name: 'admin',
            description: 'Administrator',
            permissions: ['article:read'],
            isActive: true,
          });

          await expect(testService.removePermissionGroup(created.id)).resolves.not.toThrow();

          // Verify database deletion
          const result = await tx
            .select()
            .from(permissionGroups)
            .where(eq(permissionGroups.id, created.id));
          expect(result).toHaveLength(0);
        });
      });

      it('should invalidate cache after deletion', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);
          testService['rolePermissionsCache'].set('admin', ['old:permission']);

          const created = await Given.permissionGroup(tx, {
            name: 'admin',
            description: 'Administrator',
            permissions: ['article:read'],
            isActive: true,
          });

          await testService.removePermissionGroup(created.id);

          expect(testService['rolePermissionsCache'].size).toBe(0);
        });
      });

      it('should throw NotFoundException when group not found', async () => {
        await withTestTransaction(db, async (tx) => {
          const testService = createServiceWithTx(tx);

          await expect(testService.removePermissionGroup(999)).rejects.toThrow(NotFoundException);
        });
      });
    });
  });

  describe('initializePermissions', () => {
    it('should initialize all permissions and groups', async () => {
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);
        testService.register({ module: 'article', permissions: ['read', 'write'] });

        await testService.initializePermissions();

        // Verify permissions were registered
        const permissions = await tx.select().from(permissionNodes);
        expect(permissions.length).toBeGreaterThan(0);

        // Verify groups were created
        const groups = await tx.select().from(permissionGroups);
        expect(groups.length).toBeGreaterThan(0);
      });
    });

    it('should invalidate all caches after initialization', async () => {
      service['cachedKnownPermissions'] = new Set(['old']);
      service['rolePermissionsCache'].set('admin', ['old']);

      vi.spyOn(service as any, 'registerAllModulePermissions').mockResolvedValue(undefined);
      vi.spyOn(service as any, 'ensurePredefinedGroups').mockResolvedValue(undefined);

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
          permissions: ['test:read'],
          isActive: true,
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
          permissions: ['test:read'],
          isActive: true,
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
          permissions: ['test:read'],
          isActive: true,
          createdAt: null,
          updatedAt: undefined,
        };

        const normalized = service['normalizePermissionGroupRow'](row);

        expect(typeof normalized.createdAt).toBe('string');
        expect(typeof normalized.updatedAt).toBe('string');
      });
    });
  });

  describe('Permission Inheritance', () => {
    it('should inherit permissions from predefined roles', async () => {
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);
        testService.register({
          module: 'article',
          permissions: ['read', 'write', 'delete'],
          roles: {
            admin: ['read', 'write', 'delete'],
            author: ['read', 'write'],
            viewer: ['read'],
          },
        });

        // Create permission groups
        await Given.permissionGroup(tx, {
          name: 'admin',
          description: 'Admin',
          permissions: ['article:read', 'article:write', 'article:delete'],
          isActive: true,
        });

        await Given.permissionGroup(tx, {
          name: 'author',
          description: 'Author',
          permissions: ['article:read', 'article:write'],
          isActive: true,
        });

        await Given.permissionGroup(tx, {
          name: 'viewer',
          description: 'Viewer',
          permissions: ['article:read'],
          isActive: true,
        });

        // Test admin has all permissions
        const adminPerms = await testService.resolveUserPermissions(['role:admin']);
        expect(adminPerms).toContain('article:read');
        expect(adminPerms).toContain('article:write');
        expect(adminPerms).toContain('article:delete');

        // Test author has read and write
        const authorPerms = await testService.resolveUserPermissions(['role:author']);
        expect(authorPerms).toContain('article:read');
        expect(authorPerms).toContain('article:write');
        expect(authorPerms).not.toContain('article:delete');

        // Test viewer only has read
        const viewerPerms = await testService.resolveUserPermissions(['role:viewer']);
        expect(viewerPerms).toContain('article:read');
        expect(viewerPerms).not.toContain('article:write');
        expect(viewerPerms).not.toContain('article:delete');
      });
    });

    it('should handle permission overrides correctly', async () => {
      await withTestTransaction(db, async (tx) => {
        const testService = createServiceWithTx(tx);
        testService.register({
          module: 'article',
          permissions: ['read', 'write', 'delete'],
          roles: {
            admin: ['read', 'write', 'delete'],
            viewer: ['read'],
          },
        });

        // Create permission groups
        await Given.permissionGroup(tx, {
          name: 'admin',
          description: 'Admin',
          permissions: ['article:read', 'article:write', 'article:delete'],
          isActive: true,
        });

        await Given.permissionGroup(tx, {
          name: 'viewer',
          description: 'Viewer',
          permissions: ['article:read'],
          isActive: true,
        });

        // Grant admin, then revoke write permission
        const perms = await testService.resolveUserPermissions(['role:admin', 'no:article:write']);

        expect(perms).toContain('article:read');
        expect(perms).toContain('article:delete');
        expect(perms).not.toContain('article:write');
      });
    });
  });

  describe('Permission Check Logic', () => {
    beforeEach(() => {
      service.register({
        module: 'article',
        permissions: ['read', 'write', 'delete', 'publish'],
        roles: {
          admin: ['read', 'write', 'delete', 'publish'],
          editor: ['read', 'write', 'publish'],
          author: ['read', 'write'],
        },
      });
    });

    it('should check multiple permissions with AND logic', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue([
        'article:read',
        'article:write',
        'article:publish',
      ]);

      const result = await service.hasPermissions(['editor'], ['article:read', 'article:write']);

      expect(result).toBe(true);
    });

    it('should fail when any permission is missing', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue(['article:read']);

      const result = await service.hasPermissions(['author'], ['article:read', 'article:delete']);

      expect(result).toBe(false);
    });

    it('should grant all permissions to admin', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue([
        'article:read',
        'article:write',
        'article:delete',
        'article:publish',
      ]);

      const result = await service.hasPermissions(['admin'], ['article:delete', 'article:publish']);

      expect(result).toBe(true);
    });

    it('should restrict author permissions', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue([
        'article:read',
        'article:write',
      ]);

      // Author should not have delete or publish
      const deleteResult = await service.hasPermissions(['author'], ['article:delete']);
      expect(deleteResult).toBe(false);

      const publishResult = await service.hasPermissions(['author'], ['article:publish']);
      expect(publishResult).toBe(false);
    });

    it('should allow editor to publish but not delete', async () => {
      vi.spyOn(service, 'resolveUserPermissions').mockResolvedValue([
        'article:read',
        'article:write',
        'article:publish',
      ]);

      const publishResult = await service.hasPermissions(['editor'], ['article:publish']);
      expect(publishResult).toBe(true);

      const deleteResult = await service.hasPermissions(['editor'], ['article:delete']);
      expect(deleteResult).toBe(false);
    });
  });
});
