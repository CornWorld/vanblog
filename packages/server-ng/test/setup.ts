// Vitest setup file for E2E tests
// This file is automatically loaded before tests run

import { randomUUID } from 'crypto';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

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

  return db;
}

// Setup database before tests
setupTestDatabase().catch(console.error);
