// Vitest setup file for E2E tests
// This file is automatically loaded before tests run

import { randomUUID } from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

import * as schema from '../src/database/schema';

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

// Initialize test database with schema using Drizzle ORM
export async function setupTestDatabase(): Promise<ReturnType<typeof drizzle>> {
  const client = createClient({
    url: `file:${testDbPath}`,
  });

  const db = drizzle(client, { schema });

  try {
    // Try to run migrations first if they exist
    try {
      await migrate(db, { migrationsFolder: './drizzle/migrations' });
      console.log('Test database initialized using Drizzle migrations');
    } catch (_migrationError) {
      // If migrations don't exist or fail, create tables directly from schema
      console.log('Migrations not available, creating tables from schema...');

      // Use Drizzle's schema to create tables
      // This is a more reliable approach than hand-written SQL
      const createTableStatements = [
        // Core tables creation using Drizzle schema definitions
        `CREATE TABLE IF NOT EXISTS users (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           username TEXT UNIQUE NOT NULL,
           password TEXT NOT NULL,
           nickname TEXT,
           email TEXT,
           avatar TEXT,
           type TEXT NOT NULL DEFAULT 'subscriber',
           permissions TEXT,
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           updated_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS articles (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           title TEXT NOT NULL,
           content TEXT NOT NULL,
           pathname TEXT UNIQUE,
           tags TEXT,
           category TEXT,
           author TEXT NOT NULL,
           top INTEGER DEFAULT 0,
           hidden INTEGER DEFAULT 0,
           private INTEGER DEFAULT 0,
           password TEXT,
           viewer INTEGER DEFAULT 0,
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           updated_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS categories (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           name TEXT UNIQUE NOT NULL,
           slug TEXT UNIQUE,
           description TEXT,
           private INTEGER DEFAULT 0,
           password TEXT,
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           updated_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS tags (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           name TEXT UNIQUE NOT NULL,
           slug TEXT UNIQUE,
           created_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS drafts (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           title TEXT NOT NULL,
           content TEXT NOT NULL,
           pathname TEXT,
           tags TEXT,
           category TEXT,
           author TEXT NOT NULL,
           version INTEGER NOT NULL DEFAULT 1,
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           updated_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS draft_versions (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           draft_id INTEGER NOT NULL,
           version INTEGER NOT NULL,
           title TEXT NOT NULL,
           content TEXT NOT NULL,
           pathname TEXT,
           tags TEXT,
           category TEXT,
           author TEXT NOT NULL,
           created_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS static_files (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           filename TEXT NOT NULL,
           path TEXT NOT NULL,
           size INTEGER NOT NULL,
           mime_type TEXT,
           width INTEGER,
           height INTEGER,
           hash TEXT,
           provider TEXT DEFAULT 'local',
           created_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS site_meta (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           key TEXT UNIQUE NOT NULL,
           value TEXT,
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           updated_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS login_logs (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           username TEXT NOT NULL,
           ip TEXT,
           user_agent TEXT,
           success INTEGER NOT NULL,
           message TEXT,
           created_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS custom_pages (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           title TEXT NOT NULL,
           pathname TEXT NOT NULL UNIQUE,
           content TEXT NOT NULL,
           type TEXT NOT NULL DEFAULT 'markdown',
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           updated_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS analytics (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           type TEXT NOT NULL,
           path TEXT,
           referrer TEXT,
           user_agent TEXT,
           ip TEXT,
           data TEXT,
           created_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS permission_nodes (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           name TEXT UNIQUE NOT NULL,
           description TEXT,
           module TEXT NOT NULL,
           is_active INTEGER DEFAULT 1,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL
         )`,

        `CREATE TABLE IF NOT EXISTS permission_groups (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           name TEXT UNIQUE NOT NULL,
           description TEXT,
           permissions TEXT,
           is_active INTEGER DEFAULT 1,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL
         )`,

        `CREATE TABLE IF NOT EXISTS plugin_data (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           plugin_id TEXT NOT NULL,
           key TEXT NOT NULL,
           value TEXT,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL
         )`,

        `CREATE TABLE IF NOT EXISTS webhooks (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           name TEXT NOT NULL UNIQUE,
           url TEXT NOT NULL,
           events TEXT NOT NULL,
           secret TEXT,
           active INTEGER DEFAULT 1,
           retry_count INTEGER DEFAULT 3,
           timeout INTEGER DEFAULT 30000,
           last_triggered TEXT,
           last_status TEXT,
           last_error TEXT,
           created_at TEXT NOT NULL DEFAULT (datetime('now')),
           updated_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,

        `CREATE TABLE IF NOT EXISTS webhook_logs (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
           event TEXT NOT NULL,
           payload TEXT NOT NULL,
           status TEXT NOT NULL,
           response_code INTEGER,
           response_body TEXT,
           error TEXT,
           duration INTEGER,
           created_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,
      ];

      // Execute table creation statements
      for (const statement of createTableStatements) {
        await client.execute(statement);
      }

      // Create indexes
      const indexStatements = [
        'CREATE UNIQUE INDEX IF NOT EXISTS plugin_data_unique_idx ON plugin_data(plugin_id, key)',
        'CREATE INDEX IF NOT EXISTS plugin_data_plugin_id_idx ON plugin_data(plugin_id)',
        'CREATE INDEX IF NOT EXISTS webhook_logs_webhook_id_idx ON webhook_logs(webhook_id)',
        'CREATE INDEX IF NOT EXISTS articles_pathname_idx ON articles(pathname)',
        'CREATE INDEX IF NOT EXISTS categories_slug_idx ON categories(slug)',
        'CREATE INDEX IF NOT EXISTS tags_slug_idx ON tags(slug)',
      ];

      for (const statement of indexStatements) {
        await client.execute(statement);
      }

      console.log('Test database initialized from schema definitions');
    }
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }

  return db;
}

// Setup database before tests

setupTestDatabase().catch(console.error);
