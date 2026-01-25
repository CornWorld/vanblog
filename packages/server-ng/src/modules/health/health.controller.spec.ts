import { describe, it, expect } from 'vitest';

// Note: HealthController was removed as it imported a non-existent contract
// from @vanblog/shared/contracts and was never registered in health.module.ts

describe('HealthController (DEPRECATED)', () => {
  it('should be skipped - controller was removed', () => {
    // This test file remains for documentation purposes.
    // The HealthController was removed because it imported
    // non-existent createHealthContract from @vanblog/shared/contracts
    // and was never registered in health.module.ts.
    expect(true).toBe(true);
  });
});
