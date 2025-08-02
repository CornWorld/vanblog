import { SetMetadata } from '@nestjs/common';
import { UserType } from '../user/dto/create-user.dto';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserType[]) => SetMetadata(ROLES_KEY, roles);
