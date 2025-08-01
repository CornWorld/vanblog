import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateUserSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(20, '用户名最多20个字符'),
  email: z.string().pipe(z.email('请输入有效的邮箱地址')),
  password: z.string().min(6, '密码至少6个字符').max(50, '密码最多50个字符'),
  nickname: z.string().optional(),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  role: z.enum(['admin', 'editor', 'author', 'subscriber']).default('subscriber'),
  isActive: z.boolean().default(true),
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
