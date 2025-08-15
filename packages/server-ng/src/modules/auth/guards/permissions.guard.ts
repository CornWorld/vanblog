import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionService } from '../../permission/permission.service';
import { User } from '../../user/entities/user.entity';
import { PERMISSION_KEY, MODULE_CONTEXT_KEY } from '../permissions.decorator';

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
 * @ModuleContext('category')
 * class CategoryController {
 *   @Permissions('read', 'write')  // 等价于 'category:read', 'category:write'
 *   getCategories() {}
 *
 *   @Permissions('article:read')   // 直接使用完整权限名称
 *   getCategoryArticles() {}
 * }
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取方法级别的权限要求
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

    const userPermissions = user.permissions ?? [];
    if (userPermissions.length === 0) {
      return false;
    }

    // 获取类级别的模块上下文
    const moduleContext = this.reflector.getAllAndOverride<string | undefined>(MODULE_CONTEXT_KEY, [
      context.getClass(),
    ]);

    // 解析权限名称：如果有模块上下文，将语义化名称转换为完整权限名称
    let resolvedPermissions: string[];
    if (moduleContext) {
      resolvedPermissions = this.permissionService.resolvePermissionNames(
        moduleContext,
        requiredPermissions,
      );
    } else {
      // 如果没有模块上下文，尝试从控制器路径推导模块名
      const controllerName = context.getClass().name;
      const moduleName = this.extractModuleNameFromController(controllerName);

      if (moduleName) {
        resolvedPermissions = this.permissionService.resolvePermissionNames(
          moduleName,
          requiredPermissions,
        );
      } else {
        // 无法推导模块名，直接使用原始权限名称
        resolvedPermissions = requiredPermissions;
      }
    }

    return await this.permissionService.hasPermissions(userPermissions, resolvedPermissions);
  }

  /**
   * 从控制器名称推导模块名
   * 例如：CategoryController -> category
   */
  private extractModuleNameFromController(controllerName: string): string | null {
    if (controllerName.endsWith('Controller')) {
      const moduleName = controllerName
        .replace('Controller', '')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();

      return moduleName;
    }
    return null;
  }
}
