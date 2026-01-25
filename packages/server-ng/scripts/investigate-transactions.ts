/**
 * Simple Transaction Investigation Script
 *
 * Runs outside of test framework to isolate the issue
 */

import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Define a simple test table
const testArticles = sqliteTable('test_articles', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
});

async function investigateTransactions() {
  console.log('\n🔬 Transaction Investigation Script\n');
  console.log('='.repeat(60));

  const dbPath = 'test-data/tx-investigation-standalone.db';
  const client = createClient({ url: `file:${dbPath}` });
  const { drizzle } = await import('drizzle-orm/libsql');
  const db = drizzle(client);

  try {
    // Setup: Create table
    console.log('\n📋 Setup: Creating test table...');
    await client.execute(`
      DROP TABLE IF EXISTS test_articles;
    `);
    await client.execute(`
      CREATE TABLE test_articles (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL
      );
    `);
    console.log('✓ Table created\n');

    // Test 1: Pure SQL Transaction
    console.log('━'.repeat(60));
    console.log('Test 1: Pure SQL Transaction (BEGIN/ROLLBACK)');
    console.log('━'.repeat(60));

    await client.execute('BEGIN');
    console.log('✓ BEGIN executed');

    await client.execute({
      sql: 'INSERT INTO test_articles (id, title, content) VALUES (?, ?, ?)',
      args: [1, 'SQL Test', 'Content'],
    });
    console.log('✓ INSERT executed (raw SQL)');

    const duringSql = await client.execute('SELECT * FROM test_articles WHERE id = 1');
    console.log(`✓ During transaction: Found ${String(duringSql.rows.length)} rows`);

    await client.execute('ROLLBACK');
    console.log('✓ ROLLBACK executed');

    const afterSql = await client.execute('SELECT * FROM test_articles WHERE id = 1');
    console.log(`🔍 After rollback: Found ${String(afterSql.rows.length)} rows`);
    console.log(
      afterSql.rows.length === 0
        ? '✅ PASS: SQL rollback works!\n'
        : '❌ FAIL: SQL rollback failed!\n',
    );

    // Test 2: Drizzle with Manual Transaction
    console.log('━'.repeat(60));
    console.log('Test 2: Drizzle ORM with Manual BEGIN/ROLLBACK');
    console.log('━'.repeat(60));

    await client.execute('BEGIN');
    console.log('✓ BEGIN executed');

    await db.insert(testArticles).values({
      id: 2,
      title: 'Drizzle Manual Test',
      content: 'Content',
    });
    console.log('✓ INSERT executed (Drizzle ORM)');

    const duringDrizzle = await db.select().from(testArticles).where(eq(testArticles.id, 2));
    console.log(`✓ During transaction: Found ${String(duringDrizzle.length)} rows`);

    await client.execute('ROLLBACK');
    console.log('✓ ROLLBACK executed');

    const afterDrizzle = await db.select().from(testArticles).where(eq(testArticles.id, 2));
    console.log(`🔍 After rollback: Found ${String(afterDrizzle.length)} rows`);
    console.log(
      afterDrizzle.length === 0
        ? '✅ PASS: Drizzle manual rollback works!\n'
        : '❌ FAIL: Drizzle manual rollback failed!\n',
    );

    // Test 3: Drizzle Native Transaction API
    console.log('━'.repeat(60));
    console.log('Test 3: Drizzle Native db.transaction() API');
    console.log('━'.repeat(60));

    try {
      await db.transaction(async (tx) => {
        await tx.insert(testArticles).values({
          id: 3,
          title: 'Drizzle Transaction API Test',
          content: 'Content',
        });
        console.log('✓ INSERT executed (inside db.transaction)');

        const insideTx = await tx.select().from(testArticles).where(eq(testArticles.id, 3));
        console.log(`✓ Inside transaction: Found ${String(insideTx.length)} rows`);

        // Force rollback
        throw new Error('Intentional rollback');
      });
    } catch (error: unknown) {
      console.log(`✓ Transaction rolled back: ${(error as Error).message}`);
    }

    const afterNative = await db.select().from(testArticles).where(eq(testArticles.id, 3));
    console.log(`🔍 After rollback: Found ${String(afterNative.length)} rows`);
    console.log(
      afterNative.length === 0
        ? '✅ PASS: Drizzle native rollback works!\n'
        : '❌ FAIL: Drizzle native rollback failed!\n',
    );

    // Test 4: Check PRAGMA settings
    console.log('━'.repeat(60));
    console.log('Test 4: SQLite PRAGMA Settings');
    console.log('━'.repeat(60));

    const journalMode = await client.execute('PRAGMA journal_mode;');
    console.log(`journal_mode: ${JSON.stringify(journalMode.rows[0])}`);

    const synchronous = await client.execute('PRAGMA synchronous;');
    console.log(`synchronous: ${JSON.stringify(synchronous.rows[0])}`);

    const autocommit = await client.execute('SELECT * FROM pragma_autocommit;');
    console.log(`autocommit: ${JSON.stringify(autocommit.rows[0])}`);

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎯 Investigation Complete!');
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    console.error('\n❌ Error during investigation:', error);
  } finally {
    // Cleanup
    await client.execute('DROP TABLE IF EXISTS test_articles');
    client.close();
  }
}

investigateTransactions().catch(console.error);
