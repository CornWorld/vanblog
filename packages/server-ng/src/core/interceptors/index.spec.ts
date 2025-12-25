import { describe, it, expect } from 'vitest';

import * as interceptorExports from './index';

describe('Interceptors Module Exports', () => {
  it('should export ETagCacheInterceptor', () => {
    expect(interceptorExports).toHaveProperty('ETagCacheInterceptor');
    expect(typeof interceptorExports.ETagCacheInterceptor).toBe('function');
  });

  it('should export DerivedViewInterceptor', () => {
    expect(interceptorExports).toHaveProperty('DerivedViewInterceptor');
    expect(typeof interceptorExports.DerivedViewInterceptor).toBe('function');
  });

  it('should export PerformanceInterceptor', () => {
    expect(interceptorExports).toHaveProperty('PerformanceInterceptor');
    expect(typeof interceptorExports.PerformanceInterceptor).toBe('function');
  });

  it('should have exactly 3 interceptor exports', () => {
    const exports = Object.keys(interceptorExports);
    expect(exports).toHaveLength(3);
    expect(exports).toContain('ETagCacheInterceptor');
    expect(exports).toContain('DerivedViewInterceptor');
    expect(exports).toContain('PerformanceInterceptor');
  });
});
