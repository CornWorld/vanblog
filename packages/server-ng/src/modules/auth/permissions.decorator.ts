import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permissions';

export const Permissions = (...permissions: string[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(PERMISSION_KEY, permissions);
