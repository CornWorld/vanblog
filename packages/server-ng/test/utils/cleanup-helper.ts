/**
 * Test Data Cleanup Helper
 *
 * Provides utilities to clean up test data from the database.
 * This is necessary because transaction rollback alone may not prevent
 * data pollution between tests, especially when tests fail or are interrupted.
 *
 * **Usage**:
 * ```typescript
 * import { cleanupTestData } from '../test/utils/cleanup-helper';
 *
 * afterEach(async () => {
 *   await cleanupTestData(db);
 * });
 * ```
 *
 * **Test ID Ranges**:
 * All test data should use IDs >= 900000 to avoid conflicts with real data.
 *
 * @since 2026-01-09 - Created as part of transaction investigation fix
 */

import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { gte } from 'drizzle-orm';
import {
  articles,
  articleTags,
  tags,
  categories,
  drafts,
  draftTags,
  draftVersions,
  loginLogs,
  users,
} from '@vanblog/shared/drizzle';

/**
 * Test ID ranges configuration
 * All test data should use IDs >= START_ID
 */
const TEST_ID_START = 900000;

/**
 * Delete all test data from the database
 *
 * **Important**: Deletion order matters due to foreign key constraints.
 * Tables are deleted in reverse dependency order:
 * 1. Junction tables (no dependencies)
 * 2. Child tables (depend on parent tables)
 * 3. Parent tables (depended upon by others)
 *
 * **Note**: In test environment, we delete ALL records (not just >= TEST_ID_START)
 * to ensure complete cleanup between tests.
 *
 * @param db - The database instance
 */
export async function cleanupTestData(db: LibSQLDatabase<Record<string, unknown>>): Promise<void> {
  // Delete in reverse dependency order to avoid foreign key constraint violations

  // 1. Junction tables (no dependencies)
  await db.delete(articleTags);
  await db.delete(draftTags);

  // 2. Child tables (depend on articles/drafts)
  await db.delete(draftVersions);

  // 3. Main entity tables (articles reference users)
  await db.delete(articles);
  await db.delete(drafts);
  await db.delete(tags);
  await db.delete(categories);

  // 4. User table (articles that reference users must be deleted first)
  await db.delete(users);

  // 5. Log tables (no dependencies)
  await db.delete(loginLogs);
}

/**
 * Clean up specific table(s) by ID range
 *
 * @param db - The database instance
 * @param tables - Map of table to ID column name
 *
 * @example
 * await cleanupSpecificTables(db, {
 *   [articles]: 'id',
 *   [tags]: 'id'
 * });
 */
export async function cleanupSpecificTables(
  db: LibSQLDatabase,
  tables: Record<string, string>,
): Promise<void> {
  for (const [tableName, idColumn] of Object.entries(tables)) {
    const tableObj = { articles, tags, categories, drafts, loginLogs }[tableName];
    if (tableObj) {
      await db.delete(tableObj).where(gte((tableObj as any)[idColumn], TEST_ID_START));
    }
  }
}

/**
 * Verify database is clean before test execution
 *
 * Throws an error if test data is found in the database.
 * Use in `beforeEach` to ensure test isolation.
 *
 * @param db - The database instance
 * @throws Error if test data is found
 *
 * @example
 * beforeEach(async () => {
 *   await assertDatabaseClean(db);
 * });
 */
export async function assertDatabaseClean(db: LibSQLDatabase): Promise<void> {
  const testArticles = await db.select().from(articles).where(gte(articles.id, TEST_ID_START));
  const testTags = await db.select().from(tags).where(gte(tags.id, TEST_ID_START));
  const testCategories = await db
    .select()
    .from(categories)
    .where(gte(categories.id, TEST_ID_START));
  const testDrafts = await db.select().from(drafts).where(gte(drafts.id, TEST_ID_START));

  const totalTestData =
    testArticles.length + testTags.length + testCategories.length + testDrafts.length;

  if (totalTestData > 0) {
    throw new Error(
      `Database not clean! Found ${String(totalTestData)} test records:\n` +
        `  - Articles: ${String(testArticles.length)}\n` +
        `  - Tags: ${String(testTags.length)}\n` +
        `  - Categories: ${String(testCategories.length)}\n` +
        `  - Drafts: ${String(testDrafts.length)}\n` +
        `Run 'await cleanupTestData(db)' before tests.`,
    );
  }
}

/**
 * Get count of test data in the database
 *
 * @param db - The database instance
 * @returns Object with counts per table
 */
export async function getTestDataCounts(db: LibSQLDatabase): Promise<{
  articles: number;
  tags: number;
  categories: number;
  drafts: number;
  total: number;
}> {
  const testArticles = await db.select().from(articles).where(gte(articles.id, TEST_ID_START));
  const testTags = await db.select().from(tags).where(gte(tags.id, TEST_ID_START));
  const testCategories = await db
    .select()
    .from(categories)
    .where(gte(categories.id, TEST_ID_START));
  const testDrafts = await db.select().from(drafts).where(gte(drafts.id, TEST_ID_START));

  return {
    articles: testArticles.length,
    tags: testTags.length,
    categories: testCategories.length,
    drafts: testDrafts.length,
    total: testArticles.length + testTags.length + testCategories.length + testDrafts.length,
  };
}
