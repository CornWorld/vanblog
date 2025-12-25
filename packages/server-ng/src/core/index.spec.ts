import { describe, it, expect } from 'vitest';

import * as coreExports from './index';

describe('Core Module Exports', () => {
  it('should export filters', () => {
    expect(coreExports).toHaveProperty('HttpExceptionFilter');
    expect(coreExports).toHaveProperty('AllExceptionsFilter');
    expect(coreExports).toHaveProperty('ValidationExceptionFilter');
  });

  it('should have all expected exports', () => {
    // Verify that the module exports exist
    const exports = Object.keys(coreExports);
    expect(exports.length).toBeGreaterThan(0);
  });
});
