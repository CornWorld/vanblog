import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../permissions.decorator';
import { User } from '../../user/entities/user.entity';
import { UserType } from '../../user/dto/create-user.dto';
import { PermissionService } from '../../permission/permission.service';

@Injectable()
export class EnhancedPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[] | undefined>(
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

    // 管理员拥有所有权限
    if (user.type === UserType.ADMIN) {
      return true;
    }

    const userPermissions = user.permissions ?? [];
    if (userPermissions.length === 0) {
      return false;
    }

    // 使用新的权限解析系统
    return this.permissionService.hasPermissions(userPermissions, requiredPermissions);
  }
}
