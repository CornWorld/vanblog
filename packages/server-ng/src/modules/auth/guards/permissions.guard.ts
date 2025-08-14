import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Permission } from '../../../shared/types/permission';
import { PermissionService } from '../../permission/permission.service';
import { UserType } from '../../user/dto/create-user.dto';
import { User } from '../../user/entities/user.entity';
import { PERMISSION_KEY } from '../permissions.decorator';

/**
 * Guard that checks if the current user has the required permissions to access a route.
 *
 * Permission String Examples:
 * - Basic permissions: 'article:read', 'article:write', 'user:create', 'media:delete'
 * - Group permissions: 'group:admin', 'group:editor', 'group:author', 'group:viewer'
 * - Disabled permissions: 'no:article:write', 'no:group:editor'
 * - Special permissions: 'all' (grants all permissions)
 *
 * Usage with @Permissions decorator:
 * @Permissions(['article:read', 'article:write'])
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissionData = this.reflector.getAllAndOverride<
      Permission[] | { module: string; permissions: string[] } | undefined
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!permissionData) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const { user } = request;

    if (!user) {
      return false;
    }

    if (user.type === UserType.ADMIN) {
      return true;
    }

    const userPermissions = user.permissions ?? [];
    if (userPermissions.length === 0) {
      return false;
    }

    // 处理新的模块权限格式
    let requiredPermissions: Permission[];
    if (Array.isArray(permissionData)) {
      // 传统格式：直接是权限数组
      requiredPermissions = permissionData;
    } else {
      // 新格式：包含模块上下文的对象
      const { module, permissions } = permissionData;
      requiredPermissions = this.permissionService.resolvePermissionNames(
        module,
        permissions,
      ) as Permission[];
    }

    if (requiredPermissions.length === 0) {
      return true;
    }

    // 使用 PermissionService 的权限解析逻辑
    return await this.permissionService.hasPermissions(userPermissions, requiredPermissions);
  }
}
