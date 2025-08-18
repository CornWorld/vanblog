import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiExtension } from '@nestjs/swagger';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

export const PERMISSION_KEY = 'permissions';

/**
 * 权限装饰器 - 支持多种格式的权限定义
 *
 * 支持的格式：
 * 1. 完整权限名：@Permission('module:permission1', 'module:permission2')
 * 2. 模块+权限数组：@Permission('module', ['read', 'write', 'delete'])
 *
 * @param moduleOrPermission 模块名或完整权限名
 * @param perm 权限列表（当第一个参数是模块名时使用）
 */
export function Permission(...perm: string[] | [string, string[]]): MethodDecorator {
  let permNormalized: string[];

  if (Array.isArray(perm[1])) {
    // 格式：@Permission('module', ['read', 'write'])
    const [module, list] = perm;
    permNormalized = list.map((perm) => `${module}:${perm}`);
  } else {
    // 格式：@Permission('module:permission1', 'module:permission2')
    permNormalized = perm as string[];
  }

  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    SetMetadata(PERMISSION_KEY, permNormalized),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiExtension('x-permissions', permNormalized),
  );
}

/**
 * 权限装饰器简洁别名
 * 等价于 @Permission
 */
export const Perm = Permission;
