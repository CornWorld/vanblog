import { SetMetadata } from '@nestjs/common';
import type { UserType } from '../user/dto/create-user.dto';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserType[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
