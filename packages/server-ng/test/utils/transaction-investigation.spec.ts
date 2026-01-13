/**
 * Transaction Investigation Tests
 *
 * Deep investigation into why Drizzle transactions don't work in test environment.
 * This file tests various transaction approaches to find the root cause.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@vanblog/shared/drizzle';
import { articles } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

describe('Transaction Investigation', () => {
  const testDbPath = 'test-data/transaction-investigation.db';
  let client: ReturnType<typeof createClient>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    // Create a dedicated test database for investigation
    client = createClient({ url: `file:${testDbPath}` });
    db = drizzle(client, { schema });

    // Initialize schema matching the real articles table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        pathname TEXT,
        tags TEXT,
        category TEXT,
        author TEXT NOT NULL,
        top INTEGER DEFAULT 0,
        hidden INTEGER DEFAULT 0,
        private INTEGER DEFAULT 0,
        password TEXT,
        viewer INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        category_id INTEGER
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    console.log('\n🔬 Investigation Database Setup Complete');
  });

  afterAll(async () => {
    // Cleanup
    await client.execute('DROP TABLE IF EXISTS articles');
    await client.execute('DROP TABLE IF EXISTS categories');
    client.close();
  });

  it('Test 1: Drizzle native db.transaction() with explicit rollback', async () => {
    console.log('\n📝 Test 1: Testing Drizzle native transaction API');

    let txError: Error | null = null;

    try {
      await db.transaction(async (tx) => {
        // Insert test data
        await tx.insert(articles).values({
          id: 1001,
          title: 'Transaction Test 1',
          content: 'Content',
          author: 'test',
          category: null,
          hidden: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Verify data visible inside transaction
        const insideTx = await tx.select().from(articles).where(eq(articles.id, 1001));
        console.log('  ✓ Inside transaction - found:', insideTx.length, 'rows');
        expect(insideTx).toHaveLength(1);

        // Force rollback by throwing error
        throw new Error('Intentional rollback');
      });
    } catch (error) {
      txError = error as Error;
      console.log('  ✓ Transaction rolled back due to error:', txError.message);
    }

    // Check if data was actually rolled back
    const outsideTx = await db.select().from(articles).where(eq(articles.id, 1001));
    console.log('  🔍 Outside transaction - found:', outsideTx.length, 'rows');

    if (outsideTx.length === 0) {
      console.log('  ✅ PASS: Data was rolled back correctly');
    } else {
      console.log('  ❌ FAIL: Data persisted after rollback!');
    }

    expect(outsideTx).toHaveLength(0);
  });

  it('Test 2: Manual BEGIN/ROLLBACK using raw client', async () => {
    console.log('\n📝 Test 2: Testing manual BEGIN/ROLLBACK');

    await client.execute('BEGIN');
    console.log('  ✓ Executed BEGIN');

    try {
      // Insert using Drizzle with ongoing transaction
      await db.insert(articles).values({
        id: 1002,
        title: 'Manual Transaction Test',
        content: 'Content',
        author: 'test',
        category: null,
        hidden: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Verify data visible
      const duringTx = await db.select().from(articles).where(eq(articles.id, 1002));
      console.log('  ✓ During transaction - found:', duringTx.length, 'rows');
      expect(duringTx).toHaveLength(1);

      // Manual rollback
      await client.execute('ROLLBACK');
      console.log('  ✓ Executed ROLLBACK');
    } catch (error) {
      await client.execute('ROLLBACK');
      throw error;
    }

    // Check if data was rolled back
    const afterRollback = await db.select().from(articles).where(eq(articles.id, 1002));
    console.log('  🔍 After rollback - found:', afterRollback.length, 'rows');

    if (afterRollback.length === 0) {
      console.log('  ✅ PASS: Data was rolled back correctly');
    } else {
      console.log('  ❌ FAIL: Data persisted after manual rollback!');
    }

    expect(afterRollback).toHaveLength(0);
  });

  it('Test 3: Check SQLite PRAGMA settings', async () => {
    console.log('\n📝 Test 3: Checking SQLite PRAGMA settings');

    // Check journal mode
    const journalMode = await client.execute('PRAGMA journal_mode;');
    console.log('  • journal_mode:', journalMode.rows[0]);

    // Check synchronous mode
    const synchronous = await client.execute('PRAGMA synchronous;');
    console.log('  • synchronous:', synchronous.rows[0]);

    // Check auto_vacuum
    const autoVacuum = await client.execute('PRAGMA auto_vacuum;');
    console.log('  • auto_vacuum:', autoVacuum.rows[0]);

    // Check locking_mode
    const lockingMode = await client.execute('PRAGMA locking_mode;');
    console.log('  • locking_mode:', lockingMode.rows[0]);

    // Check foreign_keys
    const foreignKeys = await client.execute('PRAGMA foreign_keys;');
    console.log('  • foreign_keys:', foreignKeys.rows[0]);
  });

  it('Test 4: Verify transaction using raw SQL only (no Drizzle)', async () => {
    console.log('\n📝 Test 4: Testing pure SQL transaction (bypass Drizzle)');

    await client.execute('BEGIN');
    console.log('  ✓ BEGIN executed');

    // Insert using raw SQL
    await client.execute({
      sql: 'INSERT INTO articles (id, title, content, author, hidden, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        1003,
        'Pure SQL Test',
        'Content',
        'test',
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    });
    console.log('  ✓ INSERT executed');

    // Check during transaction
    const duringTx = await client.execute('SELECT * FROM articles WHERE id = 1003');
    console.log('  ✓ During transaction - found:', duringTx.rows.length, 'rows');

    // Rollback
    await client.execute('ROLLBACK');
    console.log('  ✓ ROLLBACK executed');

    // Check after rollback
    const afterRollback = await client.execute('SELECT * FROM articles WHERE id = 1003');
    console.log('  🔍 After rollback - found:', afterRollback.rows.length, 'rows');

    if (afterRollback.rows.length === 0) {
      console.log('  ✅ PASS: Pure SQL rollback works correctly');
    } else {
      console.log('  ❌ FAIL: Pure SQL rollback failed!');
    }

    expect(afterRollback.rows).toHaveLength(0);
  });

  it('Test 5: Check if LibSQL client is in autocommit mode', async () => {
    console.log('\n📝 Test 5: Checking autocommit behavior');

    // Try to get autocommit status (SQLite doesn't have direct PRAGMA for this)
    // Instead, we'll test if INSERT without BEGIN/COMMIT persists
    await client.execute({
      sql: 'INSERT INTO articles (id, title, content, author, hidden, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        1004,
        'Autocommit Test',
        'Content',
        'test',
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    });
    console.log('  ✓ INSERT without transaction');

    const result = await client.execute('SELECT * FROM articles WHERE id = 1004');
    console.log('  🔍 Result:', result.rows.length, 'rows found');

    if (result.rows.length === 1) {
      console.log('  ✅ Autocommit is enabled (default SQLite behavior)');
    } else {
      console.log('  ⚠️ Unexpected: INSERT without transaction did not persist');
    }

    // Cleanup
    await client.execute('DELETE FROM articles WHERE id = 1004');
  });

  it('Test 6: Verify Drizzle uses the same connection', () => {
    console.log('\n📝 Test 6: Checking if Drizzle reuses the same connection');

    // Get client reference from Drizzle instance
    const drizzleClient = (db as any).$client;
    console.log('  • db.$client === client:', drizzleClient === client);
    console.log('  • db.$client type:', typeof drizzleClient);
    console.log('  • client type:', typeof client);

    if (drizzleClient === client) {
      console.log('  ✅ Drizzle uses the same client instance');
    } else {
      console.log('  ⚠️ Drizzle uses a different client instance!');
      console.log("  This could explain why transactions don't work.");
    }
  });

  it('Test 7: Test transaction with Drizzle $client directly', async () => {
    console.log('\n📝 Test 7: Using Drizzle $client for transaction');

    const drizzleClient = (db as any).$client;

    await drizzleClient.execute('BEGIN');
    console.log('  ✓ BEGIN via $client');

    await db.insert(articles).values({
      id: 1005,
      title: '$client Transaction Test',
      content: 'Content',
      author: 'test',
      category: null,
      hidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log('  ✓ INSERT via Drizzle');

    const duringTx = await db.select().from(articles).where(eq(articles.id, 1005));
    console.log('  ✓ During transaction - found:', duringTx.length, 'rows');

    await drizzleClient.execute('ROLLBACK');
    console.log('  ✓ ROLLBACK via $client');

    const afterRollback = await db.select().from(articles).where(eq(articles.id, 1005));
    console.log('  🔍 After rollback - found:', afterRollback.length, 'rows');

    if (afterRollback.length === 0) {
      console.log('  ✅ PASS: Transaction via $client works!');
    } else {
      console.log('  ❌ FAIL: Transaction via $client failed!');
    }

    expect(afterRollback).toHaveLength(0);
  });
});
