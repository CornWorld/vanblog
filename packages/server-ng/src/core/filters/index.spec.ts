import { describe, it, expect } from 'vitest';

import * as filterExports from './index';

describe('Filters Module Exports', () => {
  it('should export HttpExceptionFilter', () => {
    expect(filterExports).toHaveProperty('HttpExceptionFilter');
    expect(typeof filterExports.HttpExceptionFilter).toBe('function');
  });

  it('should export AllExceptionsFilter', () => {
    expect(filterExports).toHaveProperty('AllExceptionsFilter');
    expect(typeof filterExports.AllExceptionsFilter).toBe('function');
  });

  it('should export ValidationExceptionFilter', () => {
    expect(filterExports).toHaveProperty('ValidationExceptionFilter');
    expect(typeof filterExports.ValidationExceptionFilter).toBe('function');
  });

  it('should have exactly 3 filter exports', () => {
    const exports = Object.keys(filterExports);
    expect(exports).toHaveLength(3);
    expect(exports).toContain('HttpExceptionFilter');
    expect(exports).toContain('AllExceptionsFilter');
    expect(exports).toContain('ValidationExceptionFilter');
  });
});
