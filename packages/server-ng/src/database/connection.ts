import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

import type { DatabaseConfig } from '../config/database.config';
import type { LoggerService } from '../core/logger/logger.service';

export type Database = LibSQLDatabase;

export async function createDatabaseConnection(
  config: DatabaseConfig,
  logger: LoggerService,
): Promise<Database> {
  logger.log(`Initializing database with driver: ${config.driver}`, 'Database');

  let clientConfig;

  switch (config.driver) {
    case 'turso':
      clientConfig = {
        url: config.url,
        authToken:
          config.authToken != null && config.authToken !== '' ? config.authToken : undefined,
      };
      break;
    case 'd1':
      // D1 would be handled differently in Cloudflare Workers environment
      // For development, we'll use local SQLite
      clientConfig = {
        url: config.url !== '' ? config.url : 'file:./data/vanblog.db',
      };
      break;
    case 'local':
    default:
      clientConfig = {
        url: config.url !== '' ? config.url : 'file:./data/vanblog.db',
      };
  }

  const client = createClient(clientConfig);
  const db = drizzle(client);

  // Enable foreign key constraints for SQLite
  db.run(sql`PRAGMA foreign_keys = ON`)
    .then(() => {
      logger.log('Foreign key constraints enabled', 'Database');
    })
    .catch((error: unknown) => {
      logger.error('Failed to enable foreign key constraints', String(error), 'Database');
    });

  logger.log('Database connection established', 'Database');

  // Auto-run migrations in test environment is disabled in favor of schema push in test/setup.ts
  if (process.env.NODE_ENV === 'test' && process.env.DB_AUTO_MIGRATE === 'true') {
    try {
      const migrationsPath = `${process.cwd()}/drizzle/migrations`;
      logger.log(`Running migrations from: ${migrationsPath}`, 'Database');
      await migrate(db, { migrationsFolder: migrationsPath });
      logger.log('Test database migrations completed', 'Database');
    } catch (error: unknown) {
      logger.error('Failed to run test database migrations', String(error), 'Database');
      throw error;
    }
  }

  return db;
}
