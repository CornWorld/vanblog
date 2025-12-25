import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { CsrfGuard } from './csrf.guard';

import type { ExecutionContext } from '@nestjs/common';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CsrfGuard],
    }).compile();

    guard = module.get<CsrfGuard>(CsrfGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow GET requests', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
        }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow HEAD requests', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'HEAD',
        }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow OPTIONS requests', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'OPTIONS',
        }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow POST requests (CSRF validation handled by middleware)', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
        }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow PUT requests (CSRF validation handled by middleware)', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PUT',
        }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow DELETE requests (CSRF validation handled by middleware)', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'DELETE',
        }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow PATCH requests (CSRF validation handled by middleware)', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PATCH',
        }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow custom HTTP methods (CSRF validation handled by middleware)', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'CUSTOM',
        }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  describe('safe HTTP methods', () => {
    it('should skip CSRF validation for all safe methods', () => {
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

      safeMethods.forEach((method) => {
        const mockExecutionContext = {
          switchToHttp: () => ({
            getRequest: () => ({ method }),
          }),
        } as ExecutionContext;

        const result = guard.canActivate(mockExecutionContext);
        expect(result).toBe(true);
      });
    });
  });

  describe('unsafe HTTP methods', () => {
    it('should allow all unsafe methods (validated by middleware)', () => {
      const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      unsafeMethods.forEach((method) => {
        const mockExecutionContext = {
          switchToHttp: () => ({
            getRequest: () => ({ method }),
          }),
        } as ExecutionContext;

        const result = guard.canActivate(mockExecutionContext);
        expect(result).toBe(true);
      });
    });
  });

  describe('edge cases', () => {
    it('should not validate case for lowercase method names (allows through)', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'get',
          }),
        }),
      } as ExecutionContext;

      // Guard allows through all non-uppercase safe methods since validation is middleware's job
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should not validate case for mixed case method names (allows through)', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'Get',
          }),
        }),
      } as ExecutionContext;

      // Guard allows through all non-uppercase safe methods since validation is middleware's job
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle requests with csrfToken method', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            csrfToken: () => 'test-token',
          }),
        }),
      } as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle empty method name', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: '',
          }),
        }),
      } as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle request without method property', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({}) as any,
        }),
      } as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });
});
