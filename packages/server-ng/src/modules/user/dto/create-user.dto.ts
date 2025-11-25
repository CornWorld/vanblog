import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { insertUserSchema } from '../../../database';

export const CreateUserSchema = insertUserSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    permissions: true,
  })
  .extend({
    permissions: z.union([z.array(z.string()), z.string()]).optional(),
  });

// Note: avoid exporting inferred type to prevent TS constraints issues under Zod v3 typings

export class CreateUserDto extends createZodDto(CreateUserSchema) {}

// 用户类型枚举
export const UserType = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  AUTHOR: 'author',
  SUBSCRIBER: 'subscriber',
  VIEWER: 'viewer',
} as const;

export type UserType = (typeof UserType)[keyof typeof UserType];
