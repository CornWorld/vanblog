import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import type { DatabaseConfig } from '../config/database.config';
import { LoggerService } from '../core/logger/logger.service';

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

  logger.log('Database connection established', 'Database');

  return db;
}
