import { describe, it, expect } from 'vitest';

import * as middlewareExports from './index';

describe('Middlewares Module Exports', () => {
  it('should export V1DeprecationMiddleware', () => {
    expect(middlewareExports).toHaveProperty('V1DeprecationMiddleware');
    expect(typeof middlewareExports.V1DeprecationMiddleware).toBe('function');
  });

  it('should have exactly 1 middleware export', () => {
    const exports = Object.keys(middlewareExports);
    expect(exports).toHaveLength(1);
    expect(exports).toContain('V1DeprecationMiddleware');
  });
});
