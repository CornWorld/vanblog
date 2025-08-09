// Vitest setup file for E2E tests
// This file is automatically loaded before tests run

import { randomUUID } from 'crypto';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

// Set up test-specific database configuration
const testId = randomUUID();
const testDbDir = join(process.cwd(), 'test-data');
const testDbPath = join(testDbDir, `test-${testId}.db`);
const testCodeRunnerDir = join(process.cwd(), 'test-data', 'codeRunner');
const testPluginRunnerDir = join(process.cwd(), 'test-data', 'pluginRunner');

// Ensure test data directories exist
if (!existsSync(testDbDir)) {
  mkdirSync(testDbDir, { recursive: true });
}
if (!existsSync(testCodeRunnerDir)) {
  mkdirSync(testCodeRunnerDir, { recursive: true });
}
if (!existsSync(testPluginRunnerDir)) {
  mkdirSync(testPluginRunnerDir, { recursive: true });
}

// Override database configuration for tests
process.env.DATABASE_DRIVER = 'local';
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.DATABASE_FILE_PATH = testDbPath;

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.PORT = '3333'; // Use fixed test port
process.env.CODE_RUNNER_PATH = testCodeRunnerDir;
process.env.PLUGIN_RUNNER_PATH = testPluginRunnerDir;

// Initialize test database with schema
export async function setupTestDatabase(): Promise<ReturnType<typeof drizzle>> {
  const client = createClient({
    url: `file:${testDbPath}`,
  });

  const db = drizzle(client);

  // Read and execute the migration SQL directly
  const migrationSql = readFileSync(
    join(__dirname, '../drizzle/0000_mute_roxanne_simpson.sql'),
    'utf-8',
  );

  // Split by statement separator and execute each statement
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);

  for (const statement of statements) {
    if (statement.startsWith('CREATE') || statement.startsWith('INSERT')) {
      await client.execute(statement);
    }
  }

  // Manually create plugin_data table if it doesn't exist
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS plugin_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plugin_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS plugin_data_plugin_id_idx ON plugin_data(plugin_id)
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS plugin_data_key_idx ON plugin_data(plugin_id, key)
    `);

    await client.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS plugin_data_unique_idx ON plugin_data(plugin_id, key)
    `);
  } catch (error) {
    console.warn('Failed to create plugin_data table:', error);
  }

  return db;
}

// Setup database before tests

setupTestDatabase().catch(console.error);
