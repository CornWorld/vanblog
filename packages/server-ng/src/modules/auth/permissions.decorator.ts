import { applyDecorators, SetMetadata, UseGuards, type Type } from '@nestjs/common';
import { ApiBearerAuth, ApiExtension, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { ROLES_KEY } from './roles.decorator';

import type { UserType } from '../user/dto/create-user.dto';

export const PERMISSION_KEY = 'permissions';

export type PermOptions = {
  perms?: string[] | [string, string[]];
  roles?: UserType[];
  authOnly?: boolean;
};

function isModuleTuple(arg: unknown): arg is [string, string[]] {
  if (!Array.isArray(arg) || arg.length !== 2) return false;
  const arr = arg as unknown[];

  const [module, perms]: [unknown, unknown] = arr as [unknown, unknown];
  if (typeof module !== 'string' || !Array.isArray(perms)) return false;
  return (perms as unknown[]).every((v): v is string => typeof v === 'string');
}

function isStringArray(arg: unknown): arg is string[] {
  return Array.isArray(arg) && arg.every((v: unknown): v is string => typeof v === 'string');
}

function isPermOptions(arg: unknown): arg is PermOptions {
  if (arg === null || typeof arg !== 'object') return false;
  const { perms, roles, authOnly } = arg as PermOptions;
  const permsValid = perms === undefined || isModuleTuple(perms) || isStringArray(perms);
  const rolesValid =
    roles === undefined || (Array.isArray(roles) && roles.every((r) => typeof r === 'string'));
  const authOnlyValid = authOnly === undefined || typeof authOnly === 'boolean';
  return permsValid && rolesValid && authOnlyValid;
}

function normalizePermissions(input?: string[] | [string, string[]]): string[] | undefined {
  if (input === undefined) return undefined;
  if (isModuleTuple(input)) {
    const [module, list] = input;
    return list.map((p) => `${module}:${p}`);
  }
  return input;
}

export function Perm(...args: unknown[]): MethodDecorator & ClassDecorator {
  let permsNormalized: string[] | undefined;
  let roles: UserType[] | undefined;
  let authOnly = false;

  // 优先处理形如 Perm('a:b', 'c:d') 的直接权限列表
  if (args.length > 0 && isStringArray(args)) {
    permsNormalized = args;
  } else if (args.length === 2) {
    // 处理形如 Perm('module', ['read','write']) 的元组形式
    const [module, list] = args as [unknown, unknown];
    if (typeof module === 'string' && Array.isArray(list) && isStringArray(list)) {
      permsNormalized = list.map((p) => `${module}:${p}`);
    }
  } else if (args.length === 1) {
    // 处理对象形式 Perm({ perms, roles, authOnly })
    const [opt] = args;
    if (isPermOptions(opt)) {
      const { perms, roles: rolesOpt, authOnly: authOnlyOpt } = opt;
      permsNormalized = normalizePermissions(perms);
      roles = rolesOpt;
      authOnly = Boolean(authOnlyOpt);
    }
  }

  const rolesVal = Array.isArray(roles) && roles.length > 0 ? roles : undefined;
  const permsVal =
    Array.isArray(permsNormalized) && permsNormalized.length > 0 ? permsNormalized : undefined;
  const needsJwt = authOnly || !!rolesVal || !!permsVal;

  const guards: Array<Type<unknown>> = [];
  if (needsJwt) guards.push(JwtAuthGuard);
  if (rolesVal) guards.push(RolesGuard);
  if (permsVal) guards.push(PermissionsGuard);

  const decorators: Array<ClassDecorator | MethodDecorator> = [];

  if (guards.length > 0) {
    decorators.push(UseGuards(...guards));
  }

  if (permsVal) {
    decorators.push(SetMetadata(PERMISSION_KEY, permsVal));
  }
  if (rolesVal) {
    decorators.push(SetMetadata(ROLES_KEY, rolesVal));
  }

  if (guards.length > 0) {
    decorators.push(ApiBearerAuth());
    decorators.push(ApiResponse({ status: 401, description: 'Unauthorized' }));
    if (rolesVal || permsVal) {
      decorators.push(ApiResponse({ status: 403, description: 'Forbidden' }));
    }
  }

  if (permsVal) {
    decorators.push(ApiExtension('x-permissions', permsVal));
  }
  if (rolesVal) {
    decorators.push(ApiExtension('x-roles', rolesVal));
  }

  return applyDecorators(...decorators);
}

export const Permission = Perm;
