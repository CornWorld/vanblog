/**
 * Database Cleanup Utility
 *
 * Provides utilities to clean up test database between test runs.
 * This is necessary when tests run in parallel and share the same database file.
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '@vanblog/shared/drizzle';

/**
 * Clean all tables in the database.
 * This is useful for ensuring a clean state before running tests.
 *
 * @param db - The database connection
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * import { cleanupDatabase } from '@test/utils/cleanup-db';
 * import { db } from '@test/setup.unit';
 *
 * describe('MyTest', () => {
 *   beforeAll(async () => {
 *     await cleanupDatabase(db);
 *   });
 *
 *   // tests...
 * });
 */
export async function cleanupDatabase(db: LibSQLDatabase<typeof schema>): Promise<void> {
  // Delete all rows from each table
  // Order matters: delete from child tables first
  const deleteOrder = [
    'draftVersions',
    'articles',
    'drafts',
    'tags',
    'categories',
    'staticFiles',
    'analytics',
    'webhooks',
    'loginLogs',
    'users',
    'settings',
    'permissionNodes',
    'permissionGroups',
  ];

  for (const tableName of deleteOrder) {
    try {
      const table = (schema as any)[tableName];
      if (table) {
        await db.delete(table);
      }
    } catch (error) {
      // Ignore errors if table doesn't exist or is already empty
      console.warn(`Failed to clean table ${tableName}:`, error);
    }
  }
}

/**
 * Clean specific tables in the database.
 *
 * @param db - The database connection
 * @param tableNames - Array of table names to clean
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * await cleanupTables(db, ['categories', 'articles']);
 */
export async function cleanupTables(
  db: LibSQLDatabase<typeof schema>,
  tableNames: string[],
): Promise<void> {
  for (const tableName of tableNames) {
    try {
      const table = (schema as any)[tableName];
      if (table) {
        await db.delete(table);
      }
    } catch (error) {
      console.warn(`Failed to clean table ${tableName}:`, error);
    }
  }
}
