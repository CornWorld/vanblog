import { describe, it, expect } from 'vitest';
import { CsrfGuard } from './index';

describe('guards/index', () => {
  it('should export CsrfGuard', () => {
    expect(CsrfGuard).toBeDefined();
    expect(CsrfGuard.name).toBe('CsrfGuard');
  });

  it('should export a class that can be instantiated', () => {
    const guard = new CsrfGuard();
    expect(guard).toBeDefined();
    expect(guard.canActivate).toBeDefined();
    expect(typeof guard.canActivate).toBe('function');
  });
});
