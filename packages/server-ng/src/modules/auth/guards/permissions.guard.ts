import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Permission } from '../../../shared/types/permission.type';
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
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
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

    return requiredPermissions.some(
      (permission) => userPermissions.includes(permission) || userPermissions.includes('all'),
    );
  }
}
