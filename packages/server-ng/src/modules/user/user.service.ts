import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { eq, ne } from 'drizzle-orm';

import {
  DATABASE_CONNECTION,
  type Database,
  insertUserSchema,
  updateUserSchema,
} from '../../database';
import { users } from '../../database/schema';
import { HookService } from '../plugin/services/hook.service';

import { CreateUserDto, UserType } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly hookService: HookService,
  ) {}

  // 将输入规范化为 string[] | undefined（字符串按逗号拆分并去空白）
  private normalizePermissions(input: unknown): string[] | undefined {
    if (Array.isArray(input)) {
      const arr = input.filter((v): v is string => typeof v === 'string');
      return arr;
    }
    if (typeof input === 'string') {
      const parts = input
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      return parts;
    }
    return undefined;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    let userData = createUserDto;

    // Trigger beforeCreate hook
    try {
      userData = await this.hookService.applyFilters('user|beforeCreate', userData, {
        action: 'create',
      });
    } catch {
      // Hook errors should not break the main flow
    }

    const existingUser = await this.db
      .select()
      .from(users)
      .where(eq(users.username, userData.username))
      .get();

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Persist with DB schema conversions (permissions: string | string[] -> JSON string|null)
    const normalizedPermissions = this.normalizePermissions(
      (userData as unknown as { permissions?: unknown }).permissions,
    );
    const permissionsDb = insertUserSchema.shape.permissions.parse(normalizedPermissions);

    const newUser = await this.db
      .insert(users)
      .values({
        username: userData.username,
        password: hashedPassword,
        nickname: userData.nickname,
        email: userData.email,
        avatar: userData.avatar,
        type: userData.type,
        permissions: permissionsDb,
      })
      .returning()
      .get();

    const userResult = this.mapToEntity(newUser);

    // Trigger webhook event
    await this.hookService.doAction('user|afterCreate', userResult, {
      id: userResult.id,
      username: userResult.username,
      nickname: userResult.nickname,
      email: userResult.email,
      type: userResult.type,
      createdAt: userResult.createdAt,
    });

    return userResult;
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
    let userData = updateUserDto;

    // Trigger user|beforeUpdate hook
    try {
      userData = await this.hookService.applyFilters('user|beforeUpdate', userData, {
        action: 'update',
        id,
      });
    } catch {
      // Hook errors should not break the main flow
    }

    const updateData: {
      password?: string;
      nickname?: string;
      email?: string;
      avatar?: string;
      type?: UserType;
      permissions?: string | null;
    } = {};

    let passwordChanged = false;
    if (userData.password) {
      updateData.password = await bcrypt.hash(userData.password, 10);
      passwordChanged = true;
    }
    if (userData.nickname) {
      updateData.nickname = userData.nickname;
    }
    if (userData.email) {
      updateData.email = userData.email;
    }
    if (userData.avatar != null) {
      updateData.avatar = userData.avatar;
    }
    if (userData.type != null) {
      updateData.type = userData.type;
    }
    if (userData.permissions !== undefined) {
      // Prepare update data, converting permissions via DB schema
      const normalizedPermissions = this.normalizePermissions(
        (userData as unknown as { permissions?: unknown }).permissions,
      );
      const permissionsDb = updateUserSchema.shape.permissions.parse(normalizedPermissions);
      updateData.permissions = permissionsDb;
    }

    const updatedUsers = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    if (updatedUsers.length === 0) {
      throw new NotFoundException(`User with ID ${String(id)} not found`);
    }

    const userResult = this.mapToEntity(updatedUsers[0]);

    // If password was changed, trigger token revocation through hook system
    if (passwordChanged) {
      await this.hookService.doAction('user|afterPasswordChange', {
        userId: id,
        username: userResult.username,
      });
    }

    // Trigger webhook event
    await this.hookService.doAction('user|afterUpdate', userResult, {
      id: userResult.id,
      username: userResult.username,
      nickname: userResult.nickname,
      email: userResult.email,
      type: userResult.type,
      updatedAt: userResult.updatedAt,
    });

    return userResult;
  }

  async remove(id: number): Promise<void> {
    // Trigger user|beforeDelete hook
    try {
      await this.hookService.doAction(
        'user|beforeDelete',
        { id },
        {
          action: 'delete',
        },
      );
    } catch {
      // Hook errors should not break the main flow
    }

    const result = await this.db.delete(users).where(eq(users.id, id)).returning();

    if (result.length === 0) {
      throw new NotFoundException(`User with ID ${String(id)} not found`);
    }

    // Trigger webhook event
    await this.hookService.doAction('user|afterDelete', { id });
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    const user = await this.db.select().from(users).where(eq(users.username, username)).get();

    return user ? this.mapToEntity(user, true) : null;
  }

  private mapToEntity(dbUser: typeof users.$inferSelect, includePassword = false): User {
    // Normalize permissions: DB stores JSON string (or null) -> entity expects string[] | undefined
    const permissions: string[] | undefined = (() => {
      const raw = dbUser.permissions;
      if (raw == null) return undefined; // null -> undefined (not set)
      if (raw === '') return [];
      try {
        const parsedUnknown: unknown = JSON.parse(raw);
        if (
          Array.isArray(parsedUnknown) &&
          parsedUnknown.every((v: unknown): v is string => typeof v === 'string')
        ) {
          return parsedUnknown;
        }
        return [];
      } catch {
        return [];
      }
    })();

    return new User({
      id: dbUser.id,
      username: dbUser.username,
      password: includePassword ? dbUser.password : undefined,
      nickname: dbUser.nickname ?? undefined,
      email: dbUser.email ?? undefined,
      avatar: dbUser.avatar ?? undefined,
      type: dbUser.type,
      permissions,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    });
  }
}
