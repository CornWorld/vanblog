// Vitest setup file for E2E and unit tests
// This file is automatically loaded before tests run

import { execSync } from 'child_process';
import { mkdirSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory (ES module way)
const __filename = fileURLToPath(import.meta.url);
const testDir = dirname(__filename);
const packageDir = dirname(testDir); // server-ng package directory

import { createClient } from '@libsql/client';
import * as schema from '@vanblog/shared/drizzle';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { vi } from 'vitest';
import { cleanupTestData } from './utils/cleanup-helper';

// Set up test-specific database configuration
// Use a separate database file for each worker to avoid conflicts
const testDbDir = join(process.cwd(), 'test-data');

// Get worker ID from Vitest (default to '0' for single worker)
const workerId = process.env.VITEST_POOL_ID || process.env.VITEST_WORKER_ID || '0';
const testDbPath = join(testDbDir, `test-worker-${workerId}.db`);

const testCodeRunnerDir = join(process.cwd(), 'test-data', 'codeRunner');
const testPluginRunnerDir = join(process.cwd(), 'test-data', 'pluginRunner');
const testStaticDir = join(process.cwd(), 'test-data', 'static');

// Lock and ready sentinel files to coordinate multi-worker initialization
const dbReadyFile = join(testDbDir, `db.ready.${workerId}`);

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
if (!existsSync(testStaticDir)) {
  mkdirSync(testStaticDir, { recursive: true });
}

// Override database configuration for tests
process.env.DATABASE_DRIVER = 'local';
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.DATABASE_FILE_PATH = testDbPath;

// Disable any auto-migration logic in code
process.env.DB_AUTO_MIGRATE = 'false';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.PORT = '3333'; // Use fixed test port
process.env.CODE_RUNNER_PATH = testCodeRunnerDir;
process.env.PLUGIN_RUNNER_PATH = testPluginRunnerDir;
process.env.STATIC_PATH = testStaticDir;

// Global safe fetch mock to prevent unintended outbound network calls in tests
// Individual tests can override this with specific behavior
(globalThis as any).fetch = vi.fn(async () => {
  await Promise.resolve();
  throw new Error('Unexpected network call in tests');
});

// Initialize test database using drizzle-kit push
// Each worker initializes its own database independently (no coordination needed)
export async function setupTestDatabase(): Promise<LibSQLDatabase<Record<string, unknown>>> {
  console.log(`[Worker ${workerId}] setupTestDatabase() START`);
  try {
    // Check if this worker's database is already initialized
    if (existsSync(dbReadyFile)) {
      console.log(`[Worker ${workerId}] Database already initialized, cleaning up old data`);
      // Clean up old test data before reusing the database
      const tempClient = createClient({ url: `file:${testDbPath}` });
      const tempDb = drizzle(tempClient, { schema });
      await cleanupTestData(tempDb);
      tempClient.close();
    } else {
      // Initialize this worker's database
      console.log(`[Worker ${workerId}] Initializing test database at ${testDbPath}`);

      // Ensure clean DB file
      if (existsSync(testDbPath)) {
        console.log(`[Worker ${workerId}] Removing old database file`);
        unlinkSync(testDbPath);
      }

      // Use drizzle-kit push
      // drizzle-kit can read TypeScript files directly
      console.log(`[Worker ${workerId}] Running drizzle-kit push...`);
      try {
        execSync('npx drizzle-kit push', {
          stdio: 'pipe',
          cwd: packageDir,
          env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
        });
      } catch (execError: any) {
        console.error(
          `[Worker ${workerId}] drizzle-kit push failed with code ${String(execError.status)}`,
        );

        console.error(
          `[Worker ${workerId}] stdout: ${String(execError.stdout?.toString()) || 'none'}`,
        );

        console.error(
          `[Worker ${workerId}] stderr: ${String(execError.stderr?.toString()) || 'none'}`,
        );
        throw new Error(`drizzle-kit push failed: ${String(execError.message)}`);
      }

      console.log(`[Worker ${workerId}] Database initialization complete`);

      // Mark ready for this worker
      console.log(`[Worker ${workerId}] Creating ready marker: ${dbReadyFile}`);
      writeFileSync(dbReadyFile, 'ok');
      console.log(`[Worker ${workerId}] Ready marker created successfully`);
    }
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    // Exit immediately to prevent tests from running with broken setup
    process.exit(1);
  }

  console.log(`[Worker ${workerId}] Creating database client...`);
  // Create and return database client with WAL mode for better concurrency
  const client = createClient({ url: `file:${testDbPath}` });
  const db = drizzle(client, { schema }) as LibSQLDatabase<Record<string, unknown>>;

  // Enable WAL mode for better concurrency support
  // WAL mode allows multiple concurrent readers and one writer
  console.log(`[Worker ${workerId}] Enabling WAL mode...`);
  try {
    await client.execute('PRAGMA journal_mode = WAL;');
    console.log(`[Worker ${workerId}] WAL mode enabled`);
  } catch (walError) {
    console.warn(`[Worker ${workerId}] Failed to enable WAL mode:`, walError);
    // Continue anyway - tests will use default rollback journal
  }

  console.log(`[Worker ${workerId}] setupTestDatabase() END`);
  return db;
}

// Use immediately invoked async function to ensure database is initialized before any tests run
// Export the db instance for use in tests
const db = await setupTestDatabase();

// Also export the raw client for advanced use cases like transactions
// Drizzle stores the original client in the $client property
export { db };
export const dbClient = (db as any).$client;

// Validate that dbClient is properly initialized
if (!dbClient || typeof dbClient.execute !== 'function') {
  throw new Error(
    `[Worker ${workerId}] dbClient initialization failed! ` +
      `dbClient is ${dbClient === undefined ? 'undefined' : typeof dbClient}. ` +
      `This usually indicates a Drizzle initialization problem.`,
  );
}

console.log(`[Worker ${workerId}] dbClient successfully exported and validated`);
