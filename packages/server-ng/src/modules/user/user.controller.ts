import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/permissions.decorator';

import { CreateUserDto, UpdateUserDto } from './dto';
import { CreateUserSchema } from './dto/create-user.dto';
import { UpdateUserSchema } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

interface RequestWithUser {
  user: User;
}

@ApiTags('Users')
@Controller({ path: 'admin/users', version: '2' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Permission('user', ['create'])
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({ status: 201, description: '用户创建成功' })
  async create(
    @Body(new ZodValidationPipe(CreateUserSchema)) createUserDto: CreateUserDto,
  ): Promise<User> {
    return this.userService.create(createUserDto);
  }

  @Get()
  @Permission('user', ['read'])
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户列表' })
  @ApiResponse({ status: 200, description: '用户列表获取成功' })
  async findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get('collaborators')
  @Permission('user', ['read'])
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
  @Permission('user', ['read'])
  @ApiBearerAuth()
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

  @Patch(':id')
  @Permission('user', ['update'])
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新用户' })
  @ApiResponse({ status: 200, description: '用户更新成功' })
  @ApiResponse({ status: 404, description: '用户未找到' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) updateUserDto: UpdateUserDto,
  ): Promise<User> {
    const numId = Number(id);
    if (Number.isNaN(numId)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.userService.update(numId, updateUserDto);
  }

  @Get('profile/me')
  @Permission('user', ['read'])
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '用户信息获取成功' })
  async getProfile(@Request() req: RequestWithUser): Promise<User> {
    return this.userService.findOne(req.user.id);
  }

  @Delete(':id')
  @Permission('user', ['delete'])
  @ApiBearerAuth()
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
}
