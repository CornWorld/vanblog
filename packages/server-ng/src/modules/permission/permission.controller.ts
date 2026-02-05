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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Perm } from '../auth/permissions.decorator';
import { UserType } from '../user/dto/create-user.dto';

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
import { PermissionService } from './permission.service';

@ApiTags('Permissions')
@Controller({ path: 'permissions', version: '2' })
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('debug')
  @ApiOperation({ summary: 'Debug permission resolution' })
  @ApiResponse({ status: 200, description: 'Debug info' })
  async debugPermissions() {
    const userPermissions = ['role:admin'];
    const resolved = await this.permissionService.resolveUserPermissions(userPermissions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const known = (this.permissionService as any).getKnownPermissionsSet();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modulePerms = (this.permissionService as any).modulePermissions;
    return {
      userPermissions,
      resolvedPermissions: resolved,
      knownPermissionsCount: known.size,
      modulePermissions: Array.from(modulePerms.entries()),
      rolePermissions: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        admin: await (this.permissionService as any).getRolePermissions('admin'),
      },
    };
  }

  @Post('nodes')
  @Perm({ roles: [UserType.ADMIN] })
  @ApiOperation({ summary: 'Create a new permission node' })
  @ApiResponse({
    status: 201,
    description: 'Permission node created successfully',
  })
  async createPermissionNode(
    @Body()
    createPermissionNodeDto: CreatePermissionNodeDto,
  ): Promise<PermissionNodeDto> {
    return this.permissionService.createPermissionNode(createPermissionNodeDto);
  }

  @Get('nodes')
  @Perm({ roles: [UserType.ADMIN] })
  @ApiOperation({ summary: 'Get all permission nodes' })
  @ApiResponse({
    status: 200,
    description: 'Permission nodes retrieved successfully',
  })
  async findAllPermissionNodes(
    @Query()
    query: PermissionNodeQueryDto,
  ): Promise<PermissionNodeDto[]> {
    return this.permissionService.findAllPermissionNodes(query);
  }

  @Get('nodes/:id')
  @Perm({ roles: [UserType.ADMIN] })
  @ApiOperation({ summary: 'Get permission node by ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission node retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Permission node not found' })
  async findPermissionNodeById(@Param('id', ParseIntPipe) id: number): Promise<PermissionNodeDto> {
    return this.permissionService.findPermissionNodeById(id);
  }

  @Patch('nodes/:id')
  @Perm({ roles: [UserType.ADMIN] })
  @ApiOperation({ summary: 'Update permission node' })
  @ApiResponse({
    status: 200,
    description: 'Permission node updated successfully',
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
  @Perm({ roles: [UserType.ADMIN] })
  @ApiOperation({ summary: 'Delete permission node' })
  @ApiResponse({ status: 200, description: 'Permission node deleted successfully' })
  @ApiResponse({ status: 404, description: 'Permission node not found' })
  async removePermissionNode(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.permissionService.removePermissionNode(id);
  }

  @Post('groups')
  @Perm({ roles: [UserType.ADMIN] })
  @ApiOperation({ summary: 'Create a new permission group' })
  @ApiResponse({
    status: 201,
    description: 'Permission group created successfully',
  })
  async createPermissionGroup(
    @Body()
    createPermissionGroupDto: CreatePermissionGroupDto,
  ): Promise<PermissionGroupDto> {
    return this.permissionService.createPermissionGroup(createPermissionGroupDto);
  }

  @Get('groups')
  @Perm({ roles: [UserType.ADMIN] })
  @ApiOperation({ summary: 'Get all permission groups' })
  @ApiResponse({
    status: 200,
    description: 'Permission groups retrieved successfully',
  })
  async findAllPermissionGroups(
    @Query()
    query: PermissionGroupQueryDto,
  ): Promise<PermissionGroupDto[]> {
    return this.permissionService.findAllPermissionGroups(query);
  }

  @Get('groups/:id')
  @Perm({ roles: [UserType.ADMIN] })
  @ApiOperation({ summary: 'Get permission group by ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission group retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  async findPermissionGroupById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PermissionGroupDto> {
    return this.permissionService.findPermissionGroupById(id);
  }

  @Patch('groups/:id')
  @Perm({ roles: [UserType.ADMIN] })
  @ApiOperation({ summary: 'Update permission group' })
  @ApiResponse({
    status: 200,
    description: 'Permission group updated successfully',
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
  @Perm({ roles: [UserType.ADMIN] })
  @ApiOperation({ summary: 'Delete permission group' })
  @ApiResponse({ status: 200, description: 'Permission group deleted successfully' })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  async removePermissionGroup(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.permissionService.removePermissionGroup(id);
  }
}
