import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { DemoModeGuard } from './demo-mode.guard';

describe('DemoModeGuard', () => {
  let guard: DemoModeGuard;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemoModeGuard,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<DemoModeGuard>(DemoModeGuard);
    configService = module.get<ConfigService>(ConfigService);
  });
  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when demo mode is disabled', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            url: '/api/v2/admin/users',
          }),
        }),
      } as ExecutionContext;

      vi.spyOn(configService, 'get').mockReturnValue(false as any);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(configService.get).toHaveBeenCalledWith('runtime.demoMode', { infer: true });
    });

    it('should throw ForbiddenException for GET requests in demo mode', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'GET',
            url: '/api/v2/admin/users',
          }),
        }),
      } as ExecutionContext;

      vi.spyOn(configService, 'get').mockReturnValue(true as any);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should return false for POST requests in demo mode', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            url: '/api/v2/admin/users',
          }),
        }),
      } as ExecutionContext;

      vi.spyOn(configService, 'get').mockReturnValue(true as any);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should return false for PUT requests in demo mode', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'PUT',
            url: '/api/v2/admin/users/1',
          }),
        }),
      } as ExecutionContext;

      vi.spyOn(configService, 'get').mockReturnValue(true as any);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should return false for DELETE requests in demo mode', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'DELETE',
            url: '/api/v2/admin/users/1',
          }),
        }),
      } as ExecutionContext;

      vi.spyOn(configService, 'get').mockReturnValue(true as any);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should return false for PATCH requests in demo mode', () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'PATCH',
            url: '/api/v2/admin/users/1',
          }),
        }),
      } as ExecutionContext;

      vi.spyOn(configService, 'get').mockReturnValue(true as any);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
