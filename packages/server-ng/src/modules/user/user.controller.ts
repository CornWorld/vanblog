import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract, type User as ContractUser } from '@vanblog/shared';

import { Perm } from '../auth/permissions.decorator';

import { CreateUserSchema, UserType } from './dto/create-user.dto';
import { UpdateUserSchema } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

interface RequestWithUser {
  user: User;
}

function toContractUser(user: User): ContractUser {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    email: user.email,
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
   * 创建新用户
   *
   * 根据提供的用户信息创建新用户账户。需要管理员权限。
   *
   * @param createUserDto 用户创建数据传输对象
   * @returns 创建成功的用户信息
   * @throws {BadRequestException} 当用户名已存在或数据验证失败时
   */
  @Post()
  @Perm('user', ['create'])
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({ status: 201, description: '用户创建成功' })
  async create(@Body() rawBody: unknown): Promise<User> {
    const parsed = CreateUserSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', issues: parsed.error.issues });
    }
    return this.userService.create(parsed.data);
  }

  /**
   * 获取所有用户列表
   *
   * 返回系统中所有用户的信息列表。需要用户读取权限。
   *
   * @returns 用户列表数组
   */
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
   * 获取所有协作者
   *
   * 返回系统中所有具有协作者角色的用户列表。
   *
   * @returns 协作者用户列表
   */
  /**
   * 获取协作者列表
   *
   * 查询系统中所有具有协作者权限的用户列表。
   *
   * @returns 协作者用户列表
   */
  @Get('collaborators')
  @Perm('user', ['read'])
  @ApiOperation({ summary: '获取所有协作者' })
  @ApiResponse({
    status: 200,
    description: '返回协作者列表',
    type: [User],
  })
  async getCollaborators(): Promise<User[]> {
    return this.userService.getCollaborators();
  }

  /**
   * 根据ID获取用户
   *
   * 通过用户ID查询并返回用户详细信息。
   *
   * @param id 用户ID
   * @returns 用户信息
   * @throws {BadRequestException} 当用户ID无效或用户不存在时
   */
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
  @ApiOperation({ summary: '根据ID获取用户' })
  @ApiResponse({ status: 200, description: '用户获取成功' })
  @ApiResponse({ status: 404, description: '用户未找到' })
  async findOne(@Param('id') id: string): Promise<User> {
    const numId = Number(id);
    if (Number.isNaN(numId)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.userService.findOne(numId);
  }

  /**
   * 更新用户信息
   *
   * 根据用户ID更新用户的基本信息。需要用户更新权限。
   *
   * @param id 用户ID
   * @param updateUserDto 用户更新数据传输对象
   * @returns 更新后的用户信息
   * @throws {BadRequestException} 当用户ID无效或用户不存在时
   */
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
    const numId = Number(id);
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
   * 获取当前用户信息
   *
   * 获取当前登录用户的详细信息。
   *
   * @param req 包含用户信息的请求对象
   * @returns 当前用户信息
   */
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
   * 删除用户
   *
   * 根据用户ID删除指定用户。需要用户删除权限。
   *
   * @param id 用户ID
   * @returns 删除成功消息
   * @throws {BadRequestException} 当用户ID无效时
   */
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
    const numId = Number(id);
    if (Number.isNaN(numId)) {
      throw new BadRequestException('Invalid user id');
    }
    await this.userService.remove(numId);
    return { message: '用户删除成功' };
  }

  @TsRestHandler(contract.updateProfile)
  updateProfile(@Request() req: Request): unknown {
    type AuthRequest = Request & { user?: { id: number } };
    return tsRestHandler(contract.updateProfile, async ({ body }) => {
      const authUser = (req as AuthRequest).user;
      if (!authUser) {
        return { status: 401, body: { message: 'Unauthorized' } as unknown as never };
      }

      const updatedUser = await this.userService.update(authUser.id, {
        nickname: body.nickname,
        email: body.email,
        password: body.password,
        avatar: body.avatar,
      });

      return { status: 200, body: toContractUser(updatedUser) };
    });
  }

  @TsRestHandler(contract.getCollaborators)
  getCollaborators_tsrest(): unknown {
    return tsRestHandler(contract.getCollaborators, async () => {
      const collaborators = await this.userService.getCollaborators();
      return { status: 200, body: collaborators.map(toContractUser) };
    });
  }

  @TsRestHandler(contract.createCollaborator)
  createCollaborator(): unknown {
    return tsRestHandler(contract.createCollaborator, async ({ body }) => {
      const newUser = await this.userService.create({
        username: body.name,
        password: body.password,
        nickname: body.nickname,
        type: UserType.EDITOR,
        permissions: body.permissions,
      });
      return { status: 201, body: toContractUser(newUser) };
    });
  }

  @TsRestHandler(contract.updateCollaborator)
  updateCollaborator(): unknown {
    return tsRestHandler(contract.updateCollaborator, async ({ body }) => {
      const updatedUser = await this.userService.update(body.id, {
        password: body.password,
        nickname: body.nickname,
        permissions: body.permissions,
      });
      return { status: 200, body: toContractUser(updatedUser) };
    });
  }

  @TsRestHandler(contract.deleteCollaborator)
  deleteCollaborator(): unknown {
    return tsRestHandler(contract.deleteCollaborator, async ({ params }) => {
      await this.userService.remove(Number(params.id));
      return { status: 200, body: { success: true } };
    });
  }
}
