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
});
