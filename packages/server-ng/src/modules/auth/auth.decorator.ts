import { UserType } from '../user/dto/create-user.dto';

import { Perm, Permission } from './permissions.decorator';

export function RequireAuth(): MethodDecorator & ClassDecorator {
  return Perm({ authOnly: true });
}

/**
 * @deprecated 请直接使用 @Permission / @Perm 装饰器
 */
export function RequirePermissions(module: string, ...permissions: string[]): MethodDecorator {
  if (module.includes(':')) {
    return Permission(module);
  }
  return Permission(module, permissions);
}

export function RequireAdmin(): MethodDecorator & ClassDecorator {
  return Perm({ roles: [UserType.ADMIN] });
}
