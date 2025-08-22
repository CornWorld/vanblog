import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { UserType } from '../../user/dto/create-user.dto';

import { RolesGuard } from './roles.guard';

import type { ExecutionContext } from '@nestjs/common';

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
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1, type: UserType.ADMIN },
          }),
        }),
      } as ExecutionContext;

      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return true when user has required role', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1, type: UserType.ADMIN },
          }),
        }),
      } as ExecutionContext;

      const requiredRoles = [UserType.ADMIN];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return false when user lacks required role', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1, type: UserType.AUTHOR },
          }),
        }),
      } as ExecutionContext;

      const requiredRoles = [UserType.ADMIN];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return true when user has one of multiple required roles', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1, type: UserType.ADMIN },
          }),
        }),
      } as ExecutionContext;

      const requiredRoles = [UserType.ADMIN, UserType.EDITOR];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the required roles', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1, type: UserType.AUTHOR },
          }),
        }),
      } as ExecutionContext;

      const requiredRoles = [UserType.ADMIN, UserType.EDITOR];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return false when user is missing from request', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      } as ExecutionContext;

      const requiredRoles = [UserType.ADMIN];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return false when user type is missing', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 1 },
          }),
        }),
      } as ExecutionContext;

      const requiredRoles = [UserType.ADMIN];
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });
  });
});
