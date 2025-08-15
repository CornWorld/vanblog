import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Permission } from '../../../shared/types/permission';
import { PermissionService } from '../../permission/permission.service';
import { User } from '../../user/entities/user.entity';
import { PERMISSION_KEY } from '../permissions.decorator';

/**
 * Guard that checks if the current user has the required permissions to access a route.
 *
 * Permission String Examples:
 * - Basic permissions: 'article:read', 'article:write', 'user:create', 'media:delete'
 * - Role permissions: 'role:admin', 'role:editor', 'role:author', 'role:viewer'
 * - Disabled permissions: 'no:article:write', 'no:role:editor'
 * - Special permissions: 'all' (grants all permissions)
 *
 * Usage with @Permissions decorator:
 * @Permissions('user', 'read', 'write')
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
      { module: string; permissions: string[] } | undefined
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!permissionData) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const { user } = request;

    if (!user) {
      return false;
    }

    const userPermissions = user.permissions ?? [];
    if (userPermissions.length === 0) {
      return false;
    }

    const { module, permissions } = permissionData;
    const requiredPermissions = this.permissionService.resolvePermissionNames(
      module,
      permissions,
    ) as Permission[];

    if (requiredPermissions.length === 0) {
      return true;
    }

    return await this.permissionService.hasPermissions(userPermissions, requiredPermissions);
  }
}
