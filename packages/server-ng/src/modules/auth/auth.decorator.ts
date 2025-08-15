import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Permissions } from './permissions.decorator';

/**
 * 仅认证装饰器，只验证用户是否登录
 */
export function RequireAuth(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

/**
 * 权限装饰器的别名，推荐直接使用 @Permissions
 * @deprecated 请直接使用 @Permissions 装饰器
 */
export function RequirePermissions(
  module: string,
  ...permissions: string[]
): MethodDecorator & ClassDecorator {
  return Permissions(module, ...permissions);
}

export function RequireAdmin(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Admin access only' }),
  );
}
