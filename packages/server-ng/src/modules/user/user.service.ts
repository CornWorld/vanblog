import { Injectable, NotFoundException, ConflictException, Inject, Logger } from '@nestjs/common';
import { users, insertUserSchema, updateUserSchema } from '@vanblog/shared/drizzle';
import * as bcrypt from 'bcrypt';
import { eq, ne } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { HookService } from '../plugin/services/hook.service';

import { CreateUserDto, UserType } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly hookService: HookService,
  ) {}

  /**
   * 规范化权限数据格式
   *
   * 将多种权限输入格式统一转换为字符串数组或 null:
   * - 数组格式: 直接过滤并返回字符串元素（如为空则返回 null）
   * - 字符串格式: 按逗号分割后去除空白，返回非空字符串数组（如为空则返回 null）
   * - undefined: 返回 undefined（表示不修改该字段）
   * - 其他格式: 返回 null
   *
   * @param input 输入的权限数据（可能是数组、字符串或其他类型）
   * @returns 规范化后的权限数组、null 或 undefined
   */
  private normalizePermissions(input: unknown): string[] | null | undefined {
    if (input === undefined) {
      return undefined;
    }
    if (Array.isArray(input)) {
      const arr = input.filter((v): v is string => typeof v === 'string');
      return arr.length > 0 ? arr : null;
    }
    if (typeof input === 'string') {
      const parts = input
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      return parts.length > 0 ? parts : null;
    }
    return null;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    let userData = createUserDto;

    // 触发 beforeCreate 钩子，允许插件修改创建数据
    try {
      userData = await this.hookService.applyFilters('user|beforeCreate', userData, {
        action: 'create',
      });
    } catch (error: unknown) {
      // 钩子错误不应中断主流程,记录日志后继续
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Hook error in user|beforeCreate: ${errorMessage}`);
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

    // 权限数据转换：API 格式（string[] | string）-> DB 格式（string[] | null）
    // Drizzle 的 mode: 'json' 会自动处理序列化，无需手动 JSON.stringify
    const userDataWithPermissions = userData as { permissions?: unknown };
    const normalizedPermissions = this.normalizePermissions(userDataWithPermissions.permissions);
    // Zod schema 要求 array | null，不接受 undefined，所以需要转换
    const permissionsDb = insertUserSchema.shape.permissions.parse(normalizedPermissions ?? null);

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

    // 触发 afterCreate 钩子
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

  async update(id: number, updateUserDto: Partial<UpdateUserDto>): Promise<User> {
    let userData = updateUserDto;

    // 触发 user|beforeUpdate 钩子，允许插件修改更新数据
    try {
      userData = await this.hookService.applyFilters('user|beforeUpdate', userData, {
        action: 'update',
        id,
      });
    } catch (error: unknown) {
      // 钩子错误不应中断主流程,记录日志后继续
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Hook error in user|beforeUpdate: ${errorMessage}`);
    }

    // 构建更新数据对象，仅包含提供的字段
    const updateData: {
      password?: string;
      nickname?: string;
      email?: string;
      avatar?: string;
      type?: UserType;
      permissions?: string[] | null;
    } = {};

    // 密码更新：加密后存储
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
      // 权限数据转换：API 格式（string[]）-> DB 格式（string[] | null）
      // Drizzle 的 mode: 'json' 会自动处理序列化，无需手动 JSON.stringify
      const userDataWithPermissions = userData as {
        permissions?: unknown;
      };
      const normalizedPermissions = this.normalizePermissions(userDataWithPermissions.permissions);
      // Zod schema 要求 array | null，不接受 undefined，所以需要转换
      const permissionsDb = updateUserSchema.shape.permissions.parse(normalizedPermissions ?? null);
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

    const [updatedUser] = updatedUsers;

    const userResult = this.mapToEntity(updatedUser);

    // 密码修改后撤销所有令牌，强制用户重新登录
    if (passwordChanged) {
      await this.hookService.doAction('user|afterPasswordChange', {
        userId: id,
        username: userResult.username,
      });
    }

    // 触发 user|afterUpdate 钩子
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
    // 触发 user|beforeDelete 钩子
    try {
      await this.hookService.doAction(
        'user|beforeDelete',
        { id },
        {
          action: 'delete',
        },
      );
    } catch (error: unknown) {
      // 钩子错误不应中断主流程,记录日志后继续
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Hook error in user|beforeDelete: ${errorMessage}`);
    }

    const results = await this.db.delete(users).where(eq(users.id, id)).returning();

    if (results.length === 0) {
      throw new NotFoundException(`User with ID ${String(id)} not found`);
    }

    // 触发 user|afterDelete 钩子
    await this.hookService.doAction('user|afterDelete', { id });
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    const user = await this.db.select().from(users).where(eq(users.username, username)).get();

    return user ? this.mapToEntity(user, true) : null;
  }

  /**
   * 将数据库用户记录映射为实体对象
   *
   * 处理数据库与实体之间的数据格式差异:
   * - 权限字段已由 Drizzle 自动解析为 string[] | null（mode: 'json'）
   * - 可选字段从 null 转换为 undefined
   * - 根据参数决定是否包含密码字段
   *
   * @param dbUser 数据库查询结果
   * @param includePassword 是否在结果中包含密码字段（默认不包含）
   * @returns 用户实体对象
   */
  private mapToEntity(dbUser: typeof users.$inferSelect, includePassword = false): User {
    // 规范化权限：Drizzle 已返回 string[] | null（mode: 'json' 自动处理）
    // -> 实体期望 string[] | undefined
    const permissions: string[] | undefined = (() => {
      const raw = dbUser.permissions;
      if (raw == null) {
        return undefined; // null -> undefined（未设置）
      }
      // Type guard to ensure raw is an array
      if (!Array.isArray(raw)) {
        return undefined;
      }
      // Filter to ensure all elements are strings
      const stringArray = raw.filter((v): v is string => typeof v === 'string');
      return stringArray.length > 0 ? stringArray : undefined;
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
