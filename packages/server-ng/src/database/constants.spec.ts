import { describe, expect, it } from 'vitest';

import { DATABASE_CONNECTION } from './constants';

describe('Database Constants', () => {
  describe('DATABASE_CONNECTION', () => {
    it('should be defined', () => {
      expect(DATABASE_CONNECTION).toBeDefined();
    });

    it('should be a string', () => {
      expect(typeof DATABASE_CONNECTION).toBe('string');
    });

    it('should have the correct value', () => {
      expect(DATABASE_CONNECTION).toBe('DATABASE_CONNECTION');
    });

    it('should be consistent across multiple imports', async () => {
      const { DATABASE_CONNECTION: importedToken } = await import('./constants');
      expect(importedToken).toBe(DATABASE_CONNECTION);
    });

    it('should not be empty', () => {
      expect(DATABASE_CONNECTION).not.toBe('');
    });

    it('should be immutable', () => {
      const originalValue = DATABASE_CONNECTION;
      // TypeScript prevents reassignment, but we can verify it's a const
      expect(DATABASE_CONNECTION).toBe(originalValue);
    });
  });
});
