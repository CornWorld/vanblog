import { createZodDto } from 'nestjs-zod';
import { insertUserSchema } from '../../../database';

export const CreateUserSchema = insertUserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}

// 用户类型枚举
export const UserType = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  AUTHOR: 'author',
  SUBSCRIBER: 'subscriber',
} as const;

export type UserType = (typeof UserType)[keyof typeof UserType];
