/**
 * Transaction Context - AsyncLocalStorage for automatic transaction propagation
 *
 * Provides automatic transaction context management using Node.js AsyncLocalStorage.
 * This allows Given helpers and other test utilities to automatically use the current
 * transaction without requiring explicit parameter passing.
 *
 * @example
 * // In test code - no need to pass tx!
 * await withTestTransaction(db, async (tx) => {
 *   const service = new ArticleService(tx);
 *
 *   // Given.article() automatically uses the current transaction
 *   const article = await Given.article({ title: 'Test' });
 *
 *   const result = await service.findOne(article.id);
 *   expect(result).toBeDefined();
 * });
 *
 * @example
 * // Standalone usage - creates new transaction
 * const article = await Given.article({ title: 'Test' });
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

/**
 * AsyncLocalStorage for storing the current transaction context.
 * Each async call stack gets its own isolated context.
 */
const transactionContext = new AsyncLocalStorage<LibSQLDatabase>();

/**
 * Get the current transaction from AsyncLocalStorage context.
 *
 * Follows React hooks naming convention with "use" prefix to indicate
 * it's accessing contextual state.
 *
 * @returns The current transaction database instance, or undefined if not in a transaction
 *
 * @example
 * const tx = useTransaction();
 * if (tx) {
 *   // Use the transaction
 *   await tx.insert(users).values({ ... });
 * } else {
 *   // Not in a transaction context
 *   console.log('No active transaction');
 * }
 */
export function useTransaction(): LibSQLDatabase | undefined {
  return transactionContext.getStore();
}

/**
 * @deprecated Use useTransaction() instead. This alias is provided for backwards compatibility.
 */
export function getCurrentTransaction(): LibSQLDatabase | undefined {
  return useTransaction();
}

/**
 * Execute a callback within a transaction context.
 *
 * This function runs the callback with the given transaction stored in AsyncLocalStorage,
 * making it available to all nested calls via getCurrentTransaction().
 *
 * @param tx - The transaction database instance to store in context
 * @param callback - The callback to execute within the transaction context
 * @returns The result of the callback
 *
 * @example
 * await withTransactionContext(tx, async () => {
 *   // getCurrentTransaction() will return tx here
 *   const article = await Given.article({ title: 'Test' });
 *   const user = await Given.user({ name: 'John' });
 * });
 */
export async function withTransactionContext<T>(
  tx: LibSQLDatabase,
  callback: () => Promise<T>,
): Promise<T> {
  return transactionContext.run(tx, callback);
}

/**
 * Check if we're currently in a transaction context.
 *
 * @returns true if there's an active transaction context, false otherwise
 *
 * @example
 * if (isInTransactionContext()) {
 *   console.log('Inside transaction');
 * } else {
 *   console.log('Outside transaction');
 * }
 */
export function isInTransactionContext(): boolean {
  return transactionContext.getStore() !== undefined;
}
