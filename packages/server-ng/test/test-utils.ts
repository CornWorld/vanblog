import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { DATABASE_CONNECTION } from '../src/database/database.module';
import { users } from '../src/database/schema';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { hash } from 'bcrypt';

interface LoginResponse {
  token: string;
  access_token: string;
  user: unknown;
}

export async function createUser(
  app: INestApplication,
  userData = {
    username: 'testadmin',
    password: 'testpassword',
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
    password: 'testpassword',
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

    // Delete test data in reverse order of dependencies
    await db.delete(users).execute();
  } catch {
    // Ignore errors during cleanup
  }
}
