import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import type { DatabaseConfig } from '../config/database.config';
import type { LoggerService } from '../core/logger/logger.service';

export type Database = LibSQLDatabase;

export function createDatabaseConnection(config: DatabaseConfig, logger: LoggerService): Database {
  logger.log(`Initializing database with driver: ${config.driver}`, 'Database');

  let clientConfig;

  switch (config.driver) {
    case 'turso':
      clientConfig = {
        url: config.url,
        authToken: config.authToken,
      };
      break;
    case 'd1':
      // D1 would be handled differently in Cloudflare Workers environment
      // For development, we'll use local SQLite
      clientConfig = {
        url: config.url || 'file:./data/vanblog.db',
      };
      break;
    case 'local':
    default:
      clientConfig = {
        url: config.url || 'file:./data/vanblog.db',
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

  return db;
}
