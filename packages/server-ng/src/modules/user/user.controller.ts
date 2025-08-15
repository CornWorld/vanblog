import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

import { CreateUserDto, UpdateUserDto } from './dto';
import { CreateUserSchema } from './dto/create-user.dto';
import { UpdateUserSchema } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

@ApiTags('users')
@Controller({ path: 'admin/users', version: '2' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Permissions('user', 'create')
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({
    status: 201,
    description: '用户创建成功',
    type: User,
  })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  async create(
    @Body(new ZodValidationPipe(CreateUserSchema)) createUserDto: CreateUserDto,
  ): Promise<User> {
    return this.userService.create(createUserDto);
  }

  @Get()
  @Permissions('user', 'read')
  @ApiOperation({ summary: '获取所有用户' })
  @ApiResponse({
    status: 200,
    description: '返回所有用户列表',
    type: [User],
  })
  async findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get('collaborators')
  @Permissions('user', 'read')
  @ApiOperation({ summary: '获取所有协作者' })
  @ApiResponse({
    status: 200,
    description: '返回协作者列表',
    type: [User],
  })
  async getCollaborators(): Promise<User[]> {
    return this.userService.getCollaborators();
  }

  @Get(':id')
  @Permissions('user', 'read')
  @ApiOperation({ summary: '获取单个用户' })
  @ApiResponse({
    status: 200,
    description: '返回用户信息',
    type: User,
  })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async findOne(@Param('id') id: string): Promise<User> {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  @Permissions('user', 'update')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiResponse({
    status: 200,
    description: '用户更新成功',
    type: User,
  })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  @Permissions('user', 'delete')
  @ApiOperation({ summary: '删除用户' })
  @ApiResponse({ status: 200, description: '用户删除成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.userService.remove(+id);
  }
}
