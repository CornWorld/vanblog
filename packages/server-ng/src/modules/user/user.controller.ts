import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { type User } from '@vanblog/shared';

import { Perm } from '../auth/permissions.decorator';

import { UserType } from './dto/create-user.dto';
import { UpdateUserSchema } from './dto/update-user.dto';
import { User as UserEntity } from './entities/user.entity';
import { UserService } from './user.service';

interface RequestWithUser {
  user: UserEntity;
}

/** Ensure permissions is always a string[] (never undefined) to satisfy ts-rest contract */
function normalizeUser<T extends { permissions?: string[] }>(
  user: T,
): T & { permissions: string[] } {
  (user as T & { permissions: string[] }).permissions = user.permissions ?? [];
  return user as T & { permissions: string[] };
}

/**
 * 用户管理控制器
 *
 * 提供用户的 CRUD 操作，包括创建、查询、更新和删除用户，
 * 以及获取协作者列表和当前用户信息等功能。
 *
 * @author VanBlog Team
 * @since 2.0.0
 */
@ApiTags('Users')
@Controller({ path: 'admin/users', version: '2' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 创建用户
   *
   * 在系统中创建新的用户账户。
   *
   * @param createUserDto 用户创建数据传输对象
   * @returns 创建成功的用户信息
   * @throws {BadRequestException} 当数据验证失败时
   */
  @Post()
  @Perm('user', ['create'])
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({ status: 201, description: '用户创建成功' })
  async create(
    @Body()
    createUserDto: {
      username: string;
      password: string;
      nickname?: string;
      email?: string;
      type: UserType;
      permissions?: string[];
    },
  ): Promise<User> {
    return normalizeUser(await this.userService.create(createUserDto));
  }

  /**
   * 获取用户列表
   *
   * 查询系统中所有用户的信息列表。需要用户读取权限。
   *
   * @returns 用户信息列表
   */
  @Get()
  @Perm('user', ['read'])
  @ApiOperation({ summary: '获取用户列表' })
  @ApiResponse({ status: 200, description: '用户列表获取成功' })
  async findAll(): Promise<User[]> {
    return (await this.userService.findAll()).map(normalizeUser);
  }

  /**
   * 根据 ID 获取用户
   *
   * 根据用户 ID 查询单个用户的详细信息。
   *
   * @param id 用户 ID
   * @returns 用户详细信息
   * @throws {BadRequestException} 当用户 ID 格式无效时
   * @throws {NotFoundException} 当用户不存在时
   */
  @Get(':id')
  @Perm('user', ['read'])
  @ApiOperation({ summary: '根据 ID 获取用户' })
  @ApiResponse({ status: 200, description: '用户获取成功' })
  @ApiResponse({ status: 404, description: '用户未找到' })
  async findOne(@Param('id') id: string): Promise<User> {
    const trimmed = id.trim();
    const numId = parseInt(trimmed, 10);
    if (trimmed === '' || Number.isNaN(numId)) {
      throw new BadRequestException('Invalid user id');
    }
    return normalizeUser(await this.userService.findOne(numId));
  }

  /**
   * 更新用户信息
   *
   * 根据用户 ID 更新用户的信息，如用户名、邮箱、角色等。
   *
   * @param id 用户 ID
   * @param updateUserDto 用户更新数据传输对象
   * @returns 更新后的用户信息
   * @throws {BadRequestException} 当用户 ID 格式无效或数据验证失败时
   * @throws {NotFoundException} 当用户不存在时
   */
  @Patch(':id')
  @Perm('user', ['update'])
  @ApiOperation({ summary: '更新用户' })
  @ApiResponse({ status: 200, description: '用户更新成功' })
  @ApiResponse({ status: 404, description: '用户未找到' })
  async update(@Param('id') id: string, @Body() rawBody: unknown): Promise<User> {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) {
      throw new BadRequestException('Invalid user id');
    }
    const parsed = UpdateUserSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', issues: parsed.error.issues });
    }
    return normalizeUser(await this.userService.update(numId, parsed.data));
  }

  /**
   * 更新协作者（PUT，body 中含 id）
   *
   * 通过 PUT 方法更新用户信息，id 从请求体中提取。
   * 与 ts-rest 契约 `PUT /v2/admin/users` (updateCollaborator) 匹配。
   *
   * @param rawBody 包含 id 和更新字段的请求体
   * @returns 更新后的用户信息
   * @throws {BadRequestException} 当 id 缺失或数据验证失败时
   * @throws {NotFoundException} 当用户不存在时
   */
  @Put()
  @Perm('user', ['update'])
  @ApiOperation({ summary: '更新协作者（body 含 id）' })
  @ApiResponse({ status: 200, description: '用户更新成功' })
  @ApiResponse({ status: 404, description: '用户未找到' })
  async updateCollaborator(@Body() rawBody: unknown): Promise<User> {
    if (typeof rawBody !== 'object' || rawBody === null || !('id' in rawBody)) {
      throw new BadRequestException('Missing required field: id');
    }
    const { id, ...rest } = rawBody as Record<string, unknown>;
    const numId = typeof id === 'number' ? id : parseInt(String(id), 10);
    if (Number.isNaN(numId)) {
      throw new BadRequestException('Invalid user id');
    }
    const parsed = UpdateUserSchema.safeParse(rest);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', issues: parsed.error.issues });
    }
    return normalizeUser(await this.userService.update(numId, parsed.data));
  }

  /**
   * 删除用户
   *
   * 根据用户 ID 删除指定用户。删除前会检查用户是否可以被删除。
   *
   * @param id 用户 ID
   * @returns 删除操作结果消息
   * @throws {BadRequestException} 当用户 ID 格式无效或用户不能被删除时
   * @throws {NotFoundException} 当用户不存在时
   */
  @Delete(':id')
  @Perm('user', ['delete'])
  @ApiOperation({ summary: '删除用户' })
  @ApiResponse({ status: 200, description: '用户删除成功' })
  @ApiResponse({ status: 404, description: '用户未找到' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    const trimmed = id.trim();
    const numId = parseInt(trimmed, 10);
    if (trimmed === '' || Number.isNaN(numId)) {
      throw new BadRequestException('Invalid user id');
    }
    await this.userService.remove(numId);
    return { message: '用户删除成功' };
  }

  /**
   * 获取当前用户信息
   *
   * 获取当前认证用户的详细信息，基于 JWT 令牌中的用户身份。
   *
   * @param req 包含用户信息的请求对象
   * @returns 当前用户信息
   */
  @Get('profile/me')
  @Perm('user', ['read'])
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '用户信息获取成功' })
  getProfile(@Request() req: RequestWithUser): User & { permissions: string[] } {
    return normalizeUser(req.user as unknown as User);
  }

  /**
   * 获取协作者列表
   *
   * 获取系统中所有非管理员用户（协作者）列表。
   *
   * @returns 协作者列表
   */
  @Get('collaborators')
  @Perm('user', ['read'])
  @ApiOperation({ summary: '获取协作者列表' })
  @ApiResponse({ status: 200, description: '协作者列表获取成功' })
  async getCollaborators(): Promise<User[]> {
    return (await this.userService.getCollaborators()).map(normalizeUser);
  }
}
