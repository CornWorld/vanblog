// Vitest setup file for E2E and unit tests
// This file is automatically loaded before tests run

import { execSync } from 'child_process';
import { mkdirSync, existsSync, unlinkSync, openSync, closeSync, writeFileSync } from 'fs';
import { join } from 'path';

import { createClient } from '@libsql/client';
import * as schema from '@vanblog/shared/drizzle';
import { drizzle } from 'drizzle-orm/libsql';
import { vi } from 'vitest';

// Set up test-specific database configuration
// Use a fixed database name for all tests to ensure they share the same database
const testDbDir = join(process.cwd(), 'test-data');
const testDbPath = join(testDbDir, 'test-e2e.db');
const testCodeRunnerDir = join(process.cwd(), 'test-data', 'codeRunner');
const testPluginRunnerDir = join(process.cwd(), 'test-data', 'pluginRunner');
const testStaticDir = join(process.cwd(), 'test-data', 'static');
// Lock and ready sentinel files to coordinate multi-worker initialization
const dbInitLockFile = join(testDbDir, 'db.init.lock');
const dbReadyFile = join(testDbDir, 'db.ready');

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

async function waitForDbReady(timeoutMs = 120_000, intervalMs = 100): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (existsSync(dbReadyFile)) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for test database to be initialized');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function tryAcquireInitLock(): boolean {
  try {
    const fd = openSync(dbInitLockFile, 'wx');
    closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

// Initialize test database with schema using Drizzle ORM (via drizzle-kit push)
export async function setupTestDatabase(): Promise<ReturnType<typeof drizzle>> {
  try {
    if (!existsSync(dbReadyFile)) {
      if (tryAcquireInitLock()) {
        // We are the initializer: ensure a clean DB file then run push
        if (existsSync(testDbPath)) {
          unlinkSync(testDbPath);
        }
        // Run schema push using drizzle-kit, respecting drizzle.config.ts and DATABASE_URL
        // Force working directory to the server-ng package to ensure correct config resolution
        const packageDir = join(__dirname, '..');
        execSync('pnpm --silent db:push', {
          stdio: 'ignore',
          cwd: packageDir,
          env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
        });
        // Mark ready for other workers
        writeFileSync(dbReadyFile, 'ok');
        // Best effort: remove the lock to not leave stale file (not critical if it remains)
        if (existsSync(dbInitLockFile)) {
          try {
            unlinkSync(dbInitLockFile);
          } catch {
            // ignore
          }
        }
      } else {
        // Another worker is initializing; wait until ready
        await waitForDbReady();
      }
    }
  } catch (error) {
    console.error('Failed to initialize test database via drizzle-kit push:', error);
    throw error;
  }

  const client = createClient({ url: `file:${testDbPath}` });
  const db = drizzle(client, { schema });

  // Ensure this async function contains an await to satisfy lint rules
  await Promise.resolve();

  return db;
}

// Use immediately invoked async function to ensure database is initialized before any tests run
void (async () => {
  await setupTestDatabase();
})();
