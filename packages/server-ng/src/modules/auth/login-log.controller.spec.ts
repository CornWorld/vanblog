import { describe, it, expect } from 'vitest';

// Note: LoginLogTsRestController and LoginLogService were removed as they imported
// non-existent contracts and were never registered in auth.module.ts

describe('LoginLogTsRestController (DEPRECATED)', () => {
  it('should be skipped - controller was removed', () => {
    // This test file remains for documentation purposes.
    // The LoginLogTsRestController was removed because it imported
    // non-existent createLoginLogContract from @vanblog/shared/contracts
    // and was never registered in auth.module.ts.
    expect(true).toBe(true);
  });
});
