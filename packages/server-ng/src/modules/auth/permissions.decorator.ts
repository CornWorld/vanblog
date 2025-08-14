import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permissions';
export const MODULE_CONTEXT_KEY = 'module_context';

/**
 * 权限装饰器，支持语义化权限名称
 * @param permissions 权限列表，支持完整格式（如 'article:read'）或语义化格式（如 'read'）
 */
export const Permissions = (...permissions: string[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(PERMISSION_KEY, permissions);

/**
 * 模块上下文装饰器，用于指定当前模块名称
 * @param moduleName 模块名称
 */
export const ModuleContext = (moduleName: string): ReturnType<typeof SetMetadata> =>
  SetMetadata(MODULE_CONTEXT_KEY, moduleName);

/**
 * 组合装饰器，同时设置模块上下文和权限
 * @param moduleName 模块名称
 * @param permissions 权限列表（语义化名称）
 */
export const ModulePermissions = (
  moduleName: string,
  ...permissions: string[]
): ReturnType<typeof SetMetadata> => {
  return SetMetadata(PERMISSION_KEY, {
    module: moduleName,
    permissions,
  });
};
