import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';

import { PermissionService } from '../../permission/permission.service';

import { PermissionsGuard } from './permissions.guard';

import type { ExecutionContext } from '@nestjs/common';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let permissionService: PermissionService;

  beforeEach(async () => {
    const mockPermissionService = {
      hasPermissions: vi.fn(),
      resolvePermissionNames: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        Reflector,
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
    permissionService = module.get<PermissionService>(PermissionService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when no permissions are required', async () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1, username: 'testuser' },
          }),
        }),
      } as ExecutionContext;

      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return true when user has required permissions', async () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({ name: 'TestController' }),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1, username: 'testuser', permissions: ['test:read', 'test:write'] },
          }),
        }),
      } as ExecutionContext;

      const requiredPermissions = ['read', 'write'];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredPermissions);
      vi.spyOn(permissionService, 'resolvePermissionNames').mockReturnValue([
        'test:read',
        'test:write',
      ]);
      vi.spyOn(permissionService, 'hasPermissions').mockResolvedValue(true);

      const result = await guard.canActivate(mockContext);

      expect(permissionService.hasPermissions).toHaveBeenCalledWith(
        ['test:read', 'test:write'],
        ['test:read', 'test:write'],
      );
      expect(result).toBe(true);
    });

    it('should return false when user lacks required permissions', async () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({ name: 'TestController' }),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1, username: 'testuser', permissions: ['test:write'] },
          }),
        }),
      } as ExecutionContext;

      const requiredPermissions = ['read'];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredPermissions);
      vi.spyOn(permissionService, 'resolvePermissionNames').mockReturnValue(['test:read']);
      vi.spyOn(permissionService, 'hasPermissions').mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(permissionService.hasPermissions).toHaveBeenCalledWith(['test:write'], ['test:read']);
      expect(result).toBe(false);
    });

    it('should handle missing user in request', async () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({ name: 'TestController' }),
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      } as ExecutionContext;

      const requiredPermissions = ['read'];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredPermissions);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
      expect(permissionService.hasPermissions).not.toHaveBeenCalled();
    });

    it('should derive module name from controller name correctly', async () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({ name: 'ArticleController' }),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1, username: 'testuser', permissions: ['article:read'] },
          }),
        }),
      } as ExecutionContext;

      const requiredPermissions = ['read'];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredPermissions);
      vi.spyOn(permissionService, 'resolvePermissionNames').mockReturnValue(['article:read']);
      vi.spyOn(permissionService, 'hasPermissions').mockResolvedValue(true);

      await guard.canActivate(mockContext);

      expect(permissionService.hasPermissions).toHaveBeenCalledWith(
        ['article:read'],
        ['article:read'],
      );
    });

    it('should handle controller names without Controller suffix', async () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({ name: 'CustomHandler' }),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1, username: 'testuser', permissions: ['read'] },
          }),
        }),
      } as ExecutionContext;

      const requiredPermissions = ['read'];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredPermissions);
      vi.spyOn(permissionService, 'hasPermissions').mockResolvedValue(true);

      await guard.canActivate(mockContext);

      expect(permissionService.hasPermissions).toHaveBeenCalledWith(['read'], ['read']);
    });
  });
});
