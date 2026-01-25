/**
 * Database worker setup utilities
 *
 * Provides utilities for setting up isolated test databases per Vitest worker thread.
 */

import { createClient } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { drizzle } from 'drizzle-orm/libsql';
import * as fs from 'fs';
import * as path from 'path';

export interface WorkerDatabaseSetup {
  db: LibSQLDatabase;
  dbPath: string;
}

/**
 * Get unique worker ID from Vitest environment
 */
export function getWorkerIdFromEnv(): string {
  const workerId = process.env.VITEST_WORKER_ID || '0';
  return workerId;
}

/**
 * Setup isolated database for test worker
 */
export function setupWorkerDatabase(workerId: string): WorkerDatabaseSetup {
  const testDir = path.join(process.cwd(), '.test-dbs');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const dbPath = path.join(testDir, `test-worker-${workerId}.db`);

  // Remove existing database if it exists
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const client = createClient({
    url: `file:${dbPath}`,
  });

  const db = drizzle(client);

  return { db, dbPath };
}

/**
 * Cleanup worker database after tests
 */
export function cleanupWorkerDatabase(dbPath: string): void {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}
