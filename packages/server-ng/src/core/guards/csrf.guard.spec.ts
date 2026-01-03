import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { createExecutionContextMock } from '../../../test/mock';

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
    const mockExecutionContext = createExecutionContextMock({
      request: { method: 'GET' },
    }) as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow HEAD requests', () => {
    const mockExecutionContext = createExecutionContextMock({
      request: { method: 'HEAD' },
    }) as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow OPTIONS requests', () => {
    const mockExecutionContext = createExecutionContextMock({
      request: { method: 'OPTIONS' },
    }) as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow POST requests (CSRF validation handled by middleware)', () => {
    const mockExecutionContext = createExecutionContextMock({
      request: { method: 'POST' },
    }) as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow PUT requests (CSRF validation handled by middleware)', () => {
    const mockExecutionContext = createExecutionContextMock({
      request: { method: 'PUT' },
    }) as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow DELETE requests (CSRF validation handled by middleware)', () => {
    const mockExecutionContext = createExecutionContextMock({
      request: { method: 'DELETE' },
    }) as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow PATCH requests (CSRF validation handled by middleware)', () => {
    const mockExecutionContext = createExecutionContextMock({
      request: { method: 'PATCH' },
    }) as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow custom HTTP methods (CSRF validation handled by middleware)', () => {
    const mockExecutionContext = createExecutionContextMock({
      request: { method: 'CUSTOM' },
    }) as unknown as ExecutionContext;

    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  describe('safe HTTP methods', () => {
    it('should skip CSRF validation for all safe methods', () => {
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

      safeMethods.forEach((method) => {
        const mockExecutionContext = createExecutionContextMock({
          request: { method },
        }) as unknown as ExecutionContext;

        const result = guard.canActivate(mockExecutionContext);
        expect(result).toBe(true);
      });
    });
  });

  describe('unsafe HTTP methods', () => {
    it('should allow all unsafe methods (validated by middleware)', () => {
      const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      unsafeMethods.forEach((method) => {
        const mockExecutionContext = createExecutionContextMock({
          request: { method },
        }) as unknown as ExecutionContext;

        const result = guard.canActivate(mockExecutionContext);
        expect(result).toBe(true);
      });
    });
  });

  describe('edge cases', () => {
    it('should not validate case for lowercase method names (allows through)', () => {
      const mockExecutionContext = createExecutionContextMock({
        request: { method: 'get' },
      }) as unknown as ExecutionContext;

      // Guard allows through all non-uppercase safe methods since validation is middleware's job
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should not validate case for mixed case method names (allows through)', () => {
      const mockExecutionContext = createExecutionContextMock({
        request: { method: 'Get' },
      }) as unknown as ExecutionContext;

      // Guard allows through all non-uppercase safe methods since validation is middleware's job
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle requests with csrfToken method', () => {
      const mockExecutionContext = createExecutionContextMock({
        request: {
          method: 'POST',
          csrfToken: () => 'test-token',
        },
      }) as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle empty method name', () => {
      const mockExecutionContext = createExecutionContextMock({
        request: { method: '' },
      }) as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle request without method property', () => {
      const mockExecutionContext = createExecutionContextMock({
        request: {} as any,
      }) as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });
});
