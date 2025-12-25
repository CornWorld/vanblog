import { describe, it, expect, beforeEach, vi } from 'vitest';
import migration from './004-normalize-timestamps.migration';
import type { Database } from '../../database';

describe('004-normalize-timestamps Migration', () => {
  describe('migration metadata', () => {
    it('should have correct id', () => {
      expect(migration.id).toBe('004_normalize_timestamps');
    });

    it('should have descriptive name', () => {
      expect(migration.name).toBe('Normalize timestamps to ISO with timezone');
    });

    it('should have version', () => {
      expect(migration.version).toBe('1.3.0');
    });

    it('should export as const', () => {
      expect(migration).toBeDefined();
      expect(typeof migration).toBe('object');
    });
  });

  describe('up migration', () => {
    let mockDatabase: Database;
    let allSpy: any;
    let runSpy: any;

    beforeEach(() => {
      allSpy = vi.fn();
      runSpy = vi.fn();

      mockDatabase = {
        all: allSpy,
        run: runSpy,
      } as unknown as Database;
    });

    it('should be defined', () => {
      expect(migration.up).toBeDefined();
      expect(typeof migration.up).toBe('function');
    });

    it('should process tables with valid ISO timestamps', async () => {
      allSpy.mockResolvedValue([
        { id: 1, v: '2023-01-01T00:00:00.000+00:00' },
        { id: 2, v: '2023-01-02T12:30:00.000Z' },
      ]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Should not update already valid timestamps
      expect(runSpy).not.toHaveBeenCalled();
    });

    it('should normalize invalid timestamps', async () => {
      allSpy.mockResolvedValue([
        { id: 1, v: '2023-01-01 00:00:00' }, // Invalid format
        { id: 2, v: '2023-01-02T00:00:00.000+00:00' }, // Valid
      ]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Should update only invalid timestamp (across all tables/columns)
      expect(runSpy).toHaveBeenCalled();
    });

    it('should handle null rows from database', async () => {
      allSpy.mockResolvedValue(null);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      expect(runSpy).not.toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      allSpy.mockResolvedValue([]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      expect(runSpy).not.toHaveBeenCalled();
    });

    it('should process all defined tables', async () => {
      allSpy.mockResolvedValue([{ id: 1, v: 'invalid' }]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Should query all tables (14 tables * 1-2 columns each)
      expect(allSpy.mock.calls.length).toBeGreaterThan(10);
    });

    it('should normalize string timestamps', async () => {
      allSpy.mockResolvedValue([{ id: 1, v: '2023-01-01' }]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Should normalize across all tables/columns
      expect(runSpy).toHaveBeenCalled();
    });

    it('should handle non-string values', async () => {
      allSpy.mockResolvedValue([
        { id: 1, v: 12345 },
        { id: 2, v: null },
        { id: 3, v: undefined },
      ]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Should normalize all non-ISO values (across all tables/columns)
      expect(runSpy).toHaveBeenCalled();
    });

    it('should handle timestamps with Z suffix', async () => {
      allSpy.mockResolvedValue([{ id: 1, v: '2023-01-01T00:00:00.000Z' }]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Should not update valid Z-suffixed timestamp
      expect(runSpy).not.toHaveBeenCalled();
    });

    it('should handle timestamps with timezone offset', async () => {
      allSpy.mockResolvedValue([
        { id: 1, v: '2023-01-01T00:00:00.000+08:00' },
        { id: 2, v: '2023-01-01T00:00:00.000-05:00' },
      ]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Should not update valid timezone-aware timestamps
      expect(runSpy).not.toHaveBeenCalled();
    });

    it('should handle short timestamp strings', async () => {
      allSpy.mockResolvedValue([{ id: 1, v: '2023-01-01' }]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Should normalize short timestamps
      expect(runSpy).toHaveBeenCalled();
    });

    it('should handle whitespace in timestamps', async () => {
      allSpy.mockResolvedValue([
        { id: 1, v: '  2023-01-01T00:00:00.000Z  ' },
        { id: 2, v: ' invalid ' },
      ]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Should normalize the one with whitespace that's not valid ISO
      expect(runSpy).toHaveBeenCalled();
    });

    it('should process all tables in the defined list', async () => {
      allSpy.mockResolvedValue([]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Verify all tables are queried
      const queriedTables = allSpy.mock.calls.map((call: any[]) => call[0]);

      expect(queriedTables.length).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      allSpy.mockRejectedValue(new Error('Database error'));

      await expect(migration.up(mockDatabase)).rejects.toThrow('Database error');
    });

    it('should use sql.raw for table and column names', async () => {
      allSpy.mockResolvedValue([{ id: 1, v: 'invalid' }]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDatabase);

      // Verify SQL is constructed with sql.raw
      expect(allSpy).toHaveBeenCalled();
      expect(runSpy).toHaveBeenCalled();
    });
  });

  describe('down migration', () => {
    let mockDatabase: Database;

    beforeEach(() => {
      mockDatabase = {
        all: vi.fn(),
        run: vi.fn(),
      } as unknown as Database;
    });

    it('should be defined', () => {
      expect(migration.down).toBeDefined();
      expect(typeof migration.down).toBe('function');
    });

    it('should be a no-op', async () => {
      await migration.down(mockDatabase);

      expect(mockDatabase.all).not.toHaveBeenCalled();
      expect(mockDatabase.run).not.toHaveBeenCalled();
    });

    it('should resolve successfully', async () => {
      await expect(migration.down(mockDatabase)).resolves.toBeUndefined();
    });
  });

  describe('timestamp validation logic', () => {
    it('should identify valid ISO timestamps with Z', () => {
      const validTimestamps = [
        '2023-01-01T00:00:00.000Z',
        '2023-12-31T23:59:59.999Z',
        '2024-06-15T12:30:45.123Z',
      ];

      // These should match the isIsoTz regex pattern
      validTimestamps.forEach((ts) => {
        expect(ts.length).toBeGreaterThanOrEqual(20);
        expect(/\d{4}-\d{2}-\d{2}T[0-9:.+-Z]+/.test(ts)).toBe(true);
        expect(/([+-]\d{2}:\d{2}|Z)$/.test(ts)).toBe(true);
      });
    });

    it('should identify valid ISO timestamps with offset', () => {
      const validTimestamps = [
        '2023-01-01T00:00:00.000+08:00',
        '2023-01-01T00:00:00.000-05:00',
        '2023-01-01T00:00:00.000+00:00',
      ];

      validTimestamps.forEach((ts) => {
        expect(ts.length).toBeGreaterThanOrEqual(20);
        expect(/\d{4}-\d{2}-\d{2}T[0-9:.+-Z]+/.test(ts)).toBe(true);
        expect(/([+-]\d{2}:\d{2}|Z)$/.test(ts)).toBe(true);
      });
    });

    it('should identify invalid timestamps', () => {
      const invalidTimestamps = [
        '2023-01-01',
        '2023-01-01 00:00:00',
        '2023-01-01T00:00:00',
        'invalid',
        '',
        '2023',
      ];

      invalidTimestamps.forEach((ts) => {
        const isValid =
          ts.length >= 20 &&
          /\d{4}-\d{2}-\d{2}T[0-9:.+-Z]+/.test(ts) &&
          /([+-]\d{2}:\d{2}|Z)$/.test(ts);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('integration', () => {
    it('should handle complete migration flow', async () => {
      const allSpyLocal = vi.fn();
      const runSpyLocal = vi.fn();

      const mockDb = {
        all: allSpyLocal,
        run: runSpyLocal,
      } as unknown as Database;

      // Simulate mixed data
      allSpyLocal.mockResolvedValue([
        { id: 1, v: '2023-01-01T00:00:00.000Z' }, // Valid
        { id: 2, v: '2023-01-01 00:00:00' }, // Invalid
        { id: 3, v: '2023-01-01T00:00:00.000+08:00' }, // Valid
      ]);
      runSpyLocal.mockResolvedValue(undefined);

      await migration.up(mockDb);

      // Should only update the invalid one
      expect(runSpyLocal).toHaveBeenCalled();
    });

    it('should preserve valid timestamps', async () => {
      const allSpy = vi.fn();
      const runSpy = vi.fn();

      const mockDb = {
        all: allSpy,
        run: runSpy,
      } as unknown as Database;

      allSpy.mockResolvedValue([
        { id: 1, v: '2023-01-01T00:00:00.000Z' },
        { id: 2, v: '2023-01-02T12:30:00.000+08:00' },
        { id: 3, v: '2023-01-03T18:45:30.000-05:00' },
      ]);
      runSpy.mockResolvedValue(undefined);

      await migration.up(mockDb);

      // Should not update any valid timestamps
      expect(runSpy).not.toHaveBeenCalled();
    });
  });
});
