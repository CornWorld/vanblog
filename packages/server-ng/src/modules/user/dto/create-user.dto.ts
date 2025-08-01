import { z } from 'zod';
import { commonSchemas } from '../../../shared/zod';

// 用户类型枚举
export enum UserType {
  ADMIN = 'admin',
  EDITOR = 'editor',
  AUTHOR = 'author',
  SUBSCRIBER = 'subscriber',
}

export const CreateUserSchema = z.object({
  username: z
    .string()
    .describe('Username')
    .pipe(z.string().min(3, '用户名至少3个字符').max(20, '用户名最多20个字符')),
  email: commonSchemas.email,
  password: z
    .string()
    .describe('Password')
    .pipe(z.string().min(6, '密码至少6个字符').max(50, '密码最多50个字符')),
  nickname: z.string().describe('User nickname').optional(),
  avatar: z.string().describe('Avatar URL').optional(),
  bio: z.string().describe('User biography').optional(),
  role: z.enum(UserType).describe('User role').default(UserType.SUBSCRIBER),
  isActive: z.boolean().describe('Whether user is active').default(true),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
