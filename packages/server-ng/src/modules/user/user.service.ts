import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { eq, ne } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { users } from '../../database/schema';
import { safeParseJson, dataSchemas } from '../../shared/zod';
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

    const newUser = await this.db
      .insert(users)
      .values({
        username: userData.username,
        password: hashedPassword,
        nickname: userData.nickname,
        email: userData.email,
        avatar: userData.avatar,
        type: userData.type as UserType,
        permissions: userData.permissions, // persist permissions if provided
      })
      .returning()
      .get();

    const userResult = this.mapToEntity(newUser);

    // Trigger afterCreate hook
    await this.hookService.doAction('user|afterCreate', userResult, {
      action: 'create',
    });

    // Trigger webhook event
    await this.hookService.doAction('user.created', {
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

    // Trigger beforeUpdate hook
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
      updateData.permissions = userData.permissions; // allow updating/clearing permissions
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
      await this.hookService.doAction('user.passwordChanged', {
        userId: id,
        username: userResult.username,
      });
    }

    // Trigger afterUpdate hook
    await this.hookService.doAction('user|afterUpdate', userResult, {
      action: 'update',
      id,
    });

    // Trigger webhook event
    await this.hookService.doAction('user.updated', {
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
    // Trigger beforeDelete hook
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

    // Trigger afterDelete hook
    await this.hookService.doAction(
      'user|afterDelete',
      { id },
      {
        action: 'delete',
      },
    );

    // Trigger webhook event
    await this.hookService.doAction('user.deleted', { id });
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
        | string[]
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
