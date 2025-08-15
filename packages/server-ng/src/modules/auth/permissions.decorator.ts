import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

export const PERMISSION_KEY = 'permissions';
export const MODULE_CONTEXT_KEY = 'module_context';

/**
 * 模块上下文装饰器，用于指定当前模块名称
 * @param moduleName 模块名称
 */
export const ModuleContext = (moduleName: string): ReturnType<typeof SetMetadata> =>
  SetMetadata(MODULE_CONTEXT_KEY, moduleName);

/**
 * 权限装饰器，自动包含认证和权限检查
 * @param moduleName 模块名称
 * @param permissions 权限列表（语义化名称）
 */
export const Permissions = (
  moduleName: string,
  ...permissions: string[]
): MethodDecorator & ClassDecorator => {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    SetMetadata(PERMISSION_KEY, {
      module: moduleName,
      permissions,
    }),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
  );
};
