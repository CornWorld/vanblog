import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { eq, ne } from 'drizzle-orm';

import { users } from '../../database/schema';
import { safeParseJson, dataSchemas } from '../../shared/zod';

import { CreateUserDto, UserType } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

import type { Database } from '../../database/connection';
import type { Permission } from '../../shared/types/permission.type';

@Injectable()
export class UserService {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly db: Database,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.db
      .select()
      .from(users)
      .where(eq(users.username, createUserDto.username))
      .get();

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const newUser = await this.db
      .insert(users)
      .values({
        username: createUserDto.username,
        password: hashedPassword,
        nickname: createUserDto.nickname,
        email: createUserDto.email,
        avatar: createUserDto.avatar,
        type: createUserDto.type as 'admin' | 'editor' | 'author' | 'subscriber',
      })
      .returning()
      .get();

    return this.mapToEntity(newUser);
  }

  async findAll(): Promise<User[]> {
    const allUsers = await this.db.select().from(users).all();
    return allUsers.map((user) => this.mapToEntity(user));
  }

  async findOne(id: number): Promise<User> {
    const user = await this.db.select().from(users).where(eq(users.id, id)).get();

    if (!user) {
      throw new NotFoundException(`User with ID ${String(id)} not found`);
    }

    return this.mapToEntity(user);
  }

  async getAdminUser(): Promise<User | null> {
    const adminUser = await this.db.select().from(users).where(eq(users.type, 'admin')).get();

    return adminUser ? this.mapToEntity(adminUser) : null;
  }

  async getCollaborators(): Promise<User[]> {
    const collaborators = await this.db.select().from(users).where(ne(users.type, 'admin')).all();

    return collaborators.map((user) => this.mapToEntity(user));
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.db.select().from(users).where(eq(users.username, username)).get();

    return user ? this.mapToEntity(user) : null;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const updateData: {
      password?: string;
      nickname?: string;
      email?: string;
      avatar?: string;
      type?: UserType;
      permissions?: string;
    } = {};

    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    if (updateUserDto.nickname) {
      updateData.nickname = updateUserDto.nickname;
    }
    if (updateUserDto.email) {
      updateData.email = updateUserDto.email;
    }
    if (updateUserDto.avatar) {
      updateData.avatar = updateUserDto.avatar;
    }
    if (updateUserDto.type) {
      updateData.type = updateUserDto.type;
    }

    const updatedUsers = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    if (updatedUsers.length === 0) {
      throw new NotFoundException(`User with ID ${String(id)} not found`);
    }

    return this.mapToEntity(updatedUsers[0]);
  }

  async remove(id: number): Promise<void> {
    const result = await this.db.delete(users).where(eq(users.id, id)).returning();

    if (result.length === 0) {
      throw new NotFoundException(`User with ID ${String(id)} not found`);
    }
  }

  // Internal method for authentication that includes password
  async findByUsernameWithPassword(username: string): Promise<User | null> {
    const user = await this.db.select().from(users).where(eq(users.username, username)).get();

    return user ? this.mapToEntity(user, true) : null;
  }

  private mapToEntity(dbUser: typeof users.$inferSelect, includePassword = false): User {
    const userData: Partial<User> = {
      id: dbUser.id,
      username: dbUser.username,
      nickname: dbUser.nickname ?? undefined,
      email: dbUser.email ?? undefined,
      avatar: dbUser.avatar ?? undefined,
      type: dbUser.type as UserType,
      permissions: safeParseJson(dbUser.permissions, dataSchemas.permissionsArray) as
        | Permission[]
        | undefined,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    };

    if (includePassword) {
      userData.password = dbUser.password;
    }

    return new User(userData as User);
  }
}
