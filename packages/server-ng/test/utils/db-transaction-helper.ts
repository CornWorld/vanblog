/**
 * Test Transaction Helper
 *
 * Provides transaction utilities for testing that automatically rollback.
 * Uses raw SQL BEGIN/ROLLBACK commands to ensure data isolation.
 *
 * IMPORTANT: This helper now integrates with AsyncLocalStorage to provide
 * automatic transaction context propagation. Any code executed within the
 * callback (including nested Given helpers) can access the transaction
 * via getCurrentTransaction() without explicit parameter passing.
 *
 * ⚠️ IMPORTANT - TEST DATA CLEANUP REQUIRED ⚠️
 *
 * **Investigation Result** (2026-01-09): Transaction rollback functionality
 * works correctly in LibSQL + Drizzle ORM. Previous diagnosis was incorrect.
 *
 * **Real Issue**: Test data pollution due to incomplete cleanup
 * - Transaction rollback works perfectly (verified by standalone tests)
 * - Test failures were caused by:
 *   1. Residual data from previous test runs (UNIQUE constraint violations)
 *   2. Fixed test data names causing conflicts ('TxTestTag1')
 *   3. Missing cleanup after test execution
 *
 * **Evidence**:
 * ```typescript
 * // Standalone test (outside Vitest) - ALL PASS:
 * // 1. Pure SQL BEGIN/ROLLBACK: ✅ WORKS
 * // 2. Drizzle + Manual BEGIN/ROLLBACK: ✅ WORKS
 * // 3. Drizzle Native db.transaction(): ✅ WORKS
 * ```
 *
 * **Solution**: Implement proper test cleanup
 * - Use `afterEach(() => cleanupTestData(db))` in test files
 * - Ensure all test data uses unique identifiers
 * - Avoid fixed test data names
 *
 * **See Also**:
 * - Investigation report: /tmp/claude-report/transaction-investigation-final-conclusion.md
 * - Cleanup implementation: test/utils/cleanup-helper.ts (pending)
 *
 * @since 2026-01-09 - Initial implementation
 * @updated 2026-01-09 - Corrected documentation after investigation
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { dbClient } from '../setup';
import { withTransactionContext } from './transaction-context';

// Track if we're already in a transaction to avoid nesting
let inTransaction = false;

/**
 * Execute a callback within a database transaction that automatically rolls back.
 *
 * This function uses raw SQL BEGIN/ROLLBACK commands and always rolls back at the end,
 * ensuring test data isolation. Nested calls are supported - only the outermost
 * transaction will be rolled back.
 *
 * **NEW**: The transaction is automatically stored in AsyncLocalStorage context,
 * making it available to all nested calls via getCurrentTransaction().
 *
 * @param db - The database connection
 * @param callback - The callback to execute within the transaction
 * @returns The result of the callback
 *
 * @example
 * await withTestTransaction(db, async (tx) => {
 *   await tx.insert(users).values({ username: 'test' });
 *   const result = await tx.select().from(users);
 *   expect(result).toHaveLength(1);
 * });
 * // Transaction is automatically rolled back here
 *
 * @example
 * // NEW: Nested Given helpers automatically use the transaction
 * await withTestTransaction(db, async (tx) => {
 *   const service = new ArticleService(tx);
 *
 *   // Given.article() automatically uses tx via AsyncLocalStorage
 *   const article = await Given.article({ title: 'Test' });
 *
 *   const result = await service.findOne(article.id);
 *   expect(result).toBeDefined();
 * });
 */
export async function withTestTransaction<T>(
  db: LibSQLDatabase<Record<string, unknown>>,
  callback: (tx: LibSQLDatabase<Record<string, unknown>>) => Promise<T>,
): Promise<T> {
  // Use the exported dbClient which is the raw LibSQL client
  const client = dbClient as any;

  if (!client || typeof client.execute !== 'function') {
    throw new Error(
      'Database client not found or invalid. Expected a client with execute() method',
    );
  }

  // Check if we're already in a transaction
  const isNested = inTransaction;

  if (!isNested) {
    // Begin transaction (only if not already in one)
    await client.execute('BEGIN');
    inTransaction = true;
  }

  try {
    // Execute the callback with the same db instance
    // AND inject the transaction into AsyncLocalStorage context
    const result = await withTransactionContext(db, () => callback(db));

    // Always rollback for tests (never commit)
    if (!isNested) {
      await client.execute('ROLLBACK');
      inTransaction = false;
    }

    return result;
  } catch (error) {
    // Only rollback if we're the outermost transaction
    if (!isNested) {
      try {
        await client.execute('ROLLBACK');
      } catch (_rollbackError) {
        // Ignore rollback errors
      }
      inTransaction = false;
    }
    throw error;
  }
}
