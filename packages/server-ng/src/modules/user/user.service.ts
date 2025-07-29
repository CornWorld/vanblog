import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto, UserType } from './dto';
import { User } from './entities/user.entity';
import { users } from '../../db/schema';
import type { Database } from '../../db/connection';

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
        type: createUserDto.type,
        permission: createUserDto.permission ? JSON.stringify(createUserDto.permission) : null,
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
      type?: string;
      permission?: string;
    } = {};

    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    if (updateUserDto.nickname !== undefined) {
      updateData.nickname = updateUserDto.nickname;
    }
    if (updateUserDto.email !== undefined) {
      updateData.email = updateUserDto.email;
    }
    if (updateUserDto.avatar !== undefined) {
      updateData.avatar = updateUserDto.avatar;
    }
    if (updateUserDto.type !== undefined) {
      updateData.type = updateUserDto.type;
    }
    if (updateUserDto.permission) {
      updateData.permission = JSON.stringify(updateUserDto.permission);
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

  private mapToEntity(dbUser: typeof users.$inferSelect): User {
    return new User({
      id: dbUser.id,
      username: dbUser.username,
      password: dbUser.password,
      nickname: dbUser.nickname,
      email: dbUser.email,
      avatar: dbUser.avatar,
      type: dbUser.type as UserType,
      permission: dbUser.permission ? (JSON.parse(dbUser.permission) as string[]) : undefined,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    });
  }
}
