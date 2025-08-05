import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { PermissionService } from './permission.service';
import {
  CreatePermissionNodeDto,
  UpdatePermissionNodeDto,
  PermissionNodeQueryDto,
  PermissionNodeDto,
  CreatePermissionGroupDto,
  UpdatePermissionGroupDto,
  PermissionGroupQueryDto,
  PermissionGroupDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserType } from '../user/dto/create-user.dto';

@ApiTags('permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  // 权限节点管理
  @Post('nodes')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Create a new permission node' })
  @ApiResponse({
    status: 201,
    description: 'Permission node created successfully',
    type: PermissionNodeDto,
  })
  async createPermissionNode(
    @Body()
    createPermissionNodeDto: CreatePermissionNodeDto,
  ): Promise<PermissionNodeDto> {
    return this.permissionService.createPermissionNode(createPermissionNodeDto);
  }

  @Get('nodes')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Get all permission nodes' })
  @ApiResponse({
    status: 200,
    description: 'Permission nodes retrieved successfully',
    type: [PermissionNodeDto],
  })
  async findAllPermissionNodes(
    @Query()
    query: PermissionNodeQueryDto,
  ): Promise<PermissionNodeDto[]> {
    return this.permissionService.findAllPermissionNodes(query);
  }

  @Get('nodes/:id')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Get permission node by ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission node retrieved successfully',
    type: PermissionNodeDto,
  })
  @ApiResponse({ status: 404, description: 'Permission node not found' })
  async findPermissionNodeById(@Param('id', ParseIntPipe) id: number): Promise<PermissionNodeDto> {
    return this.permissionService.findPermissionNodeById(id);
  }

  @Patch('nodes/:id')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Update permission node' })
  @ApiResponse({
    status: 200,
    description: 'Permission node updated successfully',
    type: PermissionNodeDto,
  })
  @ApiResponse({ status: 404, description: 'Permission node not found' })
  async updatePermissionNode(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    updatePermissionNodeDto: UpdatePermissionNodeDto,
  ): Promise<PermissionNodeDto> {
    return this.permissionService.updatePermissionNode(id, updatePermissionNodeDto);
  }

  @Delete('nodes/:id')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Delete permission node' })
  @ApiResponse({ status: 200, description: 'Permission node deleted successfully' })
  @ApiResponse({ status: 404, description: 'Permission node not found' })
  async removePermissionNode(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.permissionService.removePermissionNode(id);
  }

  // 权限组管理
  @Post('groups')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Create a new permission group' })
  @ApiResponse({
    status: 201,
    description: 'Permission group created successfully',
    type: PermissionGroupDto,
  })
  async createPermissionGroup(
    @Body()
    createPermissionGroupDto: CreatePermissionGroupDto,
  ): Promise<PermissionGroupDto> {
    return this.permissionService.createPermissionGroup(createPermissionGroupDto);
  }

  @Get('groups')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Get all permission groups' })
  @ApiResponse({
    status: 200,
    description: 'Permission groups retrieved successfully',
    type: [PermissionGroupDto],
  })
  async findAllPermissionGroups(
    @Query()
    query: PermissionGroupQueryDto,
  ): Promise<PermissionGroupDto[]> {
    return this.permissionService.findAllPermissionGroups(query);
  }

  @Get('groups/:id')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Get permission group by ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission group retrieved successfully',
    type: PermissionGroupDto,
  })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  async findPermissionGroupById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PermissionGroupDto> {
    return this.permissionService.findPermissionGroupById(id);
  }

  @Patch('groups/:id')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Update permission group' })
  @ApiResponse({
    status: 200,
    description: 'Permission group updated successfully',
    type: PermissionGroupDto,
  })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  async updatePermissionGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    updatePermissionGroupDto: UpdatePermissionGroupDto,
  ): Promise<PermissionGroupDto> {
    return this.permissionService.updatePermissionGroup(id, updatePermissionGroupDto);
  }

  @Delete('groups/:id')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Delete permission group' })
  @ApiResponse({ status: 200, description: 'Permission group deleted successfully' })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  async removePermissionGroup(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.permissionService.removePermissionGroup(id);
  }
}
