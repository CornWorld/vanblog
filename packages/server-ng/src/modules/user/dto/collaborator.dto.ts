import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { commonSchemas } from '../../../shared/zod';

export const CollaboratorSchema = z.object({
  name: commonSchemas.nonEmptyString.describe('用户名'),
  password: commonSchemas.nonEmptyString.describe('密码'),
  nickname: z.string().optional().describe('昵称'),
  permissions: z.array(z.string()).describe('权限列表'),
});

export class CollaboratorDto extends createZodDto(CollaboratorSchema) {}
