import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Token blacklist table for revoked JWT tokens
export const tokenBlacklist = sqliteTable(
  'token_blacklist',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tokenHash: text('token_hash').notNull().unique(), // SHA-256 hash of the token
    tokenType: text('token_type', { enum: ['access', 'refresh'] }).notNull(),
    userId: integer('user_id'), // Optional: for user-specific revocations
    reason: text('reason'), // Optional: revocation reason
    expiresAt: text('expires_at').notNull(), // When the original token expires
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('token_blacklist_hash_idx').on(table.tokenHash),
    index('token_blacklist_type_idx').on(table.tokenType),
    index('token_blacklist_user_id_idx').on(table.userId),
    index('token_blacklist_expires_at_idx').on(table.expiresAt),
    index('token_blacklist_created_at_idx').on(table.createdAt),
    // Composite indexes for better query performance
    index('token_blacklist_type_user_idx').on(table.tokenType, table.userId),
    index('token_blacklist_expires_created_idx').on(table.expiresAt, table.createdAt),
  ],
);
