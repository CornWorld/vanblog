import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiExtension } from '@nestjs/swagger';

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
 * 权限装饰器，支持向后兼容的权限参数格式
 *
 * 使用方式：
 * 1. 新格式：@ModuleContext('category') + @Permissions('read', 'write')
 * 2. 旧格式：@Permissions('module', 'permission') - 向后兼容
 * 3. 完整格式：@Permissions('module:permission')
 *
 * @param permissions 权限列表（支持不同格式）
 */
export const Permissions = (...permissions: string[]): MethodDecorator => {
  // 处理向后兼容：如果是两个参数且第二个不包含冒号，转换为完整格式
  let normalizedPermissions: string[];

  if (permissions.length === 2 && !permissions[1].includes(':')) {
    // 旧格式：@Permissions('module', 'permission') -> ['module:permission']
    normalizedPermissions = [`${permissions[0]}:${permissions[1]}`];
  } else {
    // 新格式或完整格式：保持原样
    normalizedPermissions = permissions;
  }

  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    SetMetadata(PERMISSION_KEY, normalizedPermissions),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    // 将权限要求写入 OpenAPI vendor 扩展，便于文档工具消费
    ApiExtension('x-permissions', normalizedPermissions),
  );
};
