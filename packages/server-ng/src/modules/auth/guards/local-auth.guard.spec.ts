import { Test, type TestingModule } from '@nestjs/testing';

import { LocalAuthGuard } from './local-auth.guard';

import type { ExecutionContext } from '@nestjs/common';

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalAuthGuard],
    }).compile();

    guard = module.get<LocalAuthGuard>(LocalAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should call super.canActivate with the execution context', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              username: 'testuser',
              password: 'testpass',
            },
            user: { id: 1, username: 'testuser' },
          }),
        }),
      } as ExecutionContext;

      // Mock the parent canActivate method
      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(true);

      const result = await guard.canActivate(mockContext);

      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(true);
    });

    it('should return false when local authentication fails', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              username: 'testuser',
              password: 'wrongpass',
            },
          }),
        }),
      } as ExecutionContext;

      // Mock the parent canActivate method to return false
      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(false);
    });

    it('should handle missing credentials', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {},
          }),
        }),
      } as ExecutionContext;

      // Mock the parent canActivate method to throw or return false
      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(false);
    });
  });
});
