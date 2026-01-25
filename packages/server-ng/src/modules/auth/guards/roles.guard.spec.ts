import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { Mock } from '@test/mock';

import { UserType } from '../../user/dto/create-user.dto';

import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when no roles are required', () => {
      // ✅ 优化：使用新的扁平化 Mock API
      const mockContext = Mock.context({
        request: { user: { id: 1, type: UserType.ADMIN } },
      });

      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return true when user has required role', () => {
      // ✅ 优化：使用新的扁平化 Mock API
      const mockContext = Mock.context({
        request: { user: { id: 1, type: UserType.ADMIN } },
      });

      const requiredRoles = [UserType.ADMIN];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return false when user lacks required role', () => {
      // ✅ 优化：使用新的扁平化 Mock API
      const mockContext = Mock.context({
        request: { user: { id: 1, type: UserType.AUTHOR } },
      });

      const requiredRoles = [UserType.ADMIN];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return true when user has one of multiple required roles', () => {
      // ✅ 优化：使用新的扁平化 Mock API
      const mockContext = Mock.context({
        request: { user: { id: 1, type: UserType.ADMIN } },
      });

      const requiredRoles = [UserType.ADMIN, UserType.EDITOR];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the required roles', () => {
      // ✅ 优化：使用新的扁平化 Mock API
      const mockContext = Mock.context({
        request: { user: { id: 1, type: UserType.AUTHOR } },
      });

      const requiredRoles = [UserType.ADMIN, UserType.EDITOR];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return false when user is missing from request', () => {
      // ✅ 优化：使用新的扁平化 Mock API
      const mockContext = Mock.context({
        request: {},
      });

      const requiredRoles = [UserType.ADMIN];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return false when user type is missing', () => {
      // ✅ 优化：使用新的扁平化 Mock API
      const mockContext = Mock.context({
        request: { user: { id: 1 } },
      });

      const requiredRoles = [UserType.ADMIN];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });
  });
});
