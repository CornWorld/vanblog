import { hash } from 'bcrypt';
import request from 'supertest';

import { DATABASE_CONNECTION } from '../src/database/database.module';
import { users } from '../src/database/schema';

import type { INestApplication } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { Server } from 'http';

interface LoginResponse {
  token: string;
  access_token: string;
  user: unknown;
}

export async function createUser(
  app: INestApplication,
  userData = {
    username: 'testadmin',
    password: 'TestPassword123!',
    nickname: 'Test Admin',
    type: 'admin' as const,
  },
): Promise<void> {
  const db = app.get<LibSQLDatabase>(DATABASE_CONNECTION);
  const hashedPassword = await hash(userData.password, 10);

  await db.insert(users).values({
    username: userData.username,
    password: hashedPassword,
    nickname: userData.nickname,
    type: userData.type,
  });
}

export async function createAuthToken(
  app: INestApplication,
  credentials = {
    username: 'testadmin',
    password: 'TestPassword123!',
  },
): Promise<string> {
  const response = await request(app.getHttpServer() as Server)
    .post('/api/v2/auth/login')
    .send(credentials)
    .expect(200);

  const body = response.body as LoginResponse;
  return body.token;
}

export async function cleanupDatabase(app: INestApplication): Promise<void> {
  try {
    const db = app.get<LibSQLDatabase>(DATABASE_CONNECTION);

    // Import all tables from schema
    const {
      analytics,
      loginLogs,
      staticFiles,
      draftVersions,
      drafts,
      articles,
      tags,
      categories,
      siteMeta,
      customPages,

      permissionNodes,
      permissionGroups,
    } = await import('../src/database/schema');

    // Delete test data in reverse order of dependencies
    await db.delete(analytics).execute();
    await db.delete(loginLogs).execute();
    await db.delete(staticFiles).execute();
    await db.delete(draftVersions).execute();
    await db.delete(drafts).execute();
    await db.delete(articles).execute();
    await db.delete(tags).execute();
    await db.delete(categories).execute();
    await db.delete(siteMeta).execute();
    await db.delete(customPages).execute();

    await db.delete(permissionNodes).execute();
    await db.delete(permissionGroups).execute();
    await db.delete(users).execute();

    // Reset auto-increment sequences for tables with primary keys
    // This prevents SQLITE_CONSTRAINT_PRIMARYKEY errors in tests
    const { sql } = await import('drizzle-orm');
    await db.run(
      sql`DELETE FROM sqlite_sequence WHERE name IN ('analytics', 'loginLogs', 'staticFiles', 'draftVersions', 'drafts', 'articles', 'tags', 'categories', 'siteMeta', 'customPages', 'permissionNodes', 'permissionGroups')`,
    );
    await db.run(sql`DELETE FROM sqlite_sequence WHERE name = 'users'`);
  } catch {
    // Ignore errors during cleanup
  }
}
