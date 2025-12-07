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

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

// 用户类型枚举
export const UserType = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  AUTHOR: 'author',
  SUBSCRIBER: 'subscriber',
  VIEWER: 'viewer',
} as const;

export type UserType = (typeof UserType)[keyof typeof UserType];
