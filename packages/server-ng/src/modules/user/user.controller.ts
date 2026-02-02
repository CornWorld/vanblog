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
  ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { initContract } from '@ts-rest/core';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract, type User } from '@vanblog/shared';
import { createUserContract, type User as ContractUser } from '@vanblog/shared/contracts';

import { Perm } from '../auth/permissions.decorator';

import { UserType } from './dto/create-user.dto';
import { UpdateUserSchema } from './dto/update-user.dto';
import { User as UserEntity } from './entities/user.entity';
import { UserService } from './user.service';

// Initialize contract
const c = initContract();
const userContract = createUserContract(c);

interface RequestWithUser {
  user: UserEntity;
}

function toContractUser(user: UserEntity): ContractUser {
  return {
    id: user.id,
    username: user.username,
    type: user.type,
    nickname: user.nickname ?? undefined,
    avatar: user.avatar ?? undefined,
    email: user.email ?? undefined,
    permissions: user.permissions ?? [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
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
    return this.userService.create(createUserDto);
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
    return this.userService.findAll();
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
    return this.userService.findOne(numId);
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
    return this.userService.update(numId, parsed.data);
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
  getProfile(@Request() req: RequestWithUser): User {
    return req.user;
  }

  /**
   * Update user profile (ts-rest endpoint)
   * Updates the current user's profile information
   */
  @TsRestHandler(contract.updateProfile)
  @Perm('user', ['update'])
  @Patch()
  updateProfile_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateProfile, async ({ body, request }) => {
      const req = request as { user?: UserEntity };
      if (!req.user) {
        throw new BadRequestException('User not authenticated');
      }

      const updateData = {
        nickname: body.nickname,
        avatar: body.avatar,
        email: body.email,
        password: body.password,
        oldPassword: body.oldPassword,
      };

      const updatedUser = await this.userService.update(req.user.id, updateData);
      return { status: 200, body: updatedUser };
    });
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
    return this.userService.getCollaborators();
  }

  // Note: updateProfile was removed as it conflicted with updateCollaborator
  // Both used @TsRestHandler(userContract.update), causing duplicate route registration
  // Users should use the update() method with their user ID instead

  @TsRestHandler(userContract.collaborators)
  @Perm('user', ['read'])
  @Get()
  getCollaborators_tsrest(): unknown {
    return tsRestHandler(userContract.collaborators, async () => {
      const collaborators = await this.userService.getCollaborators();
      return { status: 200, body: collaborators.map(toContractUser) };
    });
  }

  @TsRestHandler(userContract.create)
  @Perm('user', ['create'])
  @Post()
  createCollaborator(): unknown {
    return tsRestHandler(userContract.create, async ({ body }) => {
      // Validate required fields
      if (!body.username || !body.password) {
        throw new BadRequestException('Username and password are required');
      }

      try {
        const newUser = await this.userService.create({
          username: body.username,
          password: body.password,
          nickname: body.nickname,
          email: body.email,
          type: body.type || UserType.EDITOR,
          permissions: body.permissions,
        });
        return { status: 201, body: toContractUser(newUser) };
      } catch (error) {
        if (error instanceof ConflictException) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }
    });
  }

  @TsRestHandler(userContract.update)
  @Perm('user', ['update'])
  @Put()
  updateCollaborator(): unknown {
    return tsRestHandler(userContract.update, async ({ params, body }) => {
      if (!params.id) {
        throw new BadRequestException('User ID is required');
      }
      const trimmed = params.id.trim();
      const userId = parseInt(trimmed, 10);
      if (trimmed === '' || Number.isNaN(userId)) {
        throw new BadRequestException('Invalid user ID');
      }

      const updateData = {
        password: body.password,
        nickname: body.nickname,
        permissions: body.permissions,
      };

      const updatedUser = await this.userService.update(userId, updateData);
      return { status: 200, body: toContractUser(updatedUser) };
    });
  }

  @TsRestHandler(userContract.delete)
  @Perm('user', ['delete'])
  @Delete()
  deleteCollaborator(): unknown {
    return tsRestHandler(userContract.delete, async ({ params }) => {
      if (!params.id) {
        throw new BadRequestException('User ID is required');
      }
      const trimmed = params.id.trim();
      const id = parseInt(trimmed, 10);
      if (trimmed === '' || Number.isNaN(id)) {
        throw new BadRequestException('Invalid user ID');
      }
      await this.userService.remove(id);
      return { status: 200, body: { success: true } };
    });
  }
}
