import { c } from '@vanblog/shared';
import { z } from 'zod';

export const CollaboratorSchema = z.object({
  name: c.nonEmptyString.describe('用户名'),
  password: c.nonEmptyString.describe('密码'),
  nickname: z.string().optional().describe('昵称'),
  permissions: z.array(z.string()).describe('权限列表'),
});

export type CollaboratorDto = z.infer<typeof CollaboratorSchema>;
