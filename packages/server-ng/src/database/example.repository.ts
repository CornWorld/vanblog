import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE_CONNECTION } from './database.module';
import { users } from './schema';

import type { Database } from './connection';

/**
 * Example repository showing how to use Drizzle ORM with dependency injection
 * This file can be removed once real repositories are implemented
 */
@Injectable()
export class ExampleRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async findUserByUsername(username: string): Promise<unknown> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);

    return result[0];
  }

  async createUser(data: {
    username: string;
    password: string;
    nickname?: string;
  }): Promise<unknown> {
    const result = await this.db.insert(users).values(data).returning();

    return result[0];
  }

  async getAllUsers(): Promise<unknown[]> {
    return this.db.select().from(users);
  }
}
