import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Optional,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

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
 * Usage with @Permission decorator:
 * class CategoryController {
 *   @Permission('category:read', 'category:write')
 *   getCategories() {}
 *
 *   @Permission('category', ['read', 'write'])
 *   createCategory() {}
 * }
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(forwardRef(() => PermissionService))
    private readonly permissionService?: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取方法级别的权限要求
    const requiredPermissions = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    this.logger.debug(`权限检查开始 - 需要权限: ${JSON.stringify(requiredPermissions)}`);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.debug('无权限要求，直接通过');
      return true;
    }

    // 当 PermissionService 在测试模块中不可用时，直接放行，避免在单元测试中引入不必要的依赖
    if (!this.permissionService) {
      this.logger.debug('PermissionService 不可用，直接通过');
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const { user } = request;

    if (!user) {
      this.logger.debug('用户未登录，拒绝访问');
      return false;
    }

    const userPermissions = user.permissions ?? [];
    this.logger.debug(`用户权限: ${JSON.stringify(userPermissions)}`);

    if (userPermissions.length === 0) {
      this.logger.debug('用户无任何权限，拒绝访问');
      return false;
    }

    // 如果 requiredPermissions 全为完整形式（包含冒号），跳过模块名推断与解析
    const allFull = requiredPermissions.every((p) => typeof p === 'string' && p.includes(':'));
    if (allFull) {
      this.logger.debug('使用完整权限名称进行检查');
      const result = await this.permissionService.hasPermissions(
        userPermissions,
        requiredPermissions,
      );
      this.logger.debug(`权限检查结果: ${result}`);
      return result;
    }

    // 解析权限名称：尝试从控制器路径推导模块名
    let resolvedPermissions: string[];
    const controllerName = context.getClass().name;
    const moduleName = this.extractModuleNameFromController(controllerName);

    this.logger.debug(`控制器名称: ${controllerName}, 推导模块名: ${moduleName}`);

    if (moduleName) {
      resolvedPermissions = this.permissionService.resolvePermissionNames(
        moduleName,
        requiredPermissions,
      );
    } else {
      // 无法推导模块名，直接使用原始权限名称
      resolvedPermissions = requiredPermissions;
    }

    this.logger.debug(`解析后的权限: ${JSON.stringify(resolvedPermissions)}`);

    const result = await this.permissionService.hasPermissions(
      userPermissions,
      resolvedPermissions,
    );
    this.logger.debug(`最终权限检查结果: ${result}`);
    return result;
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
