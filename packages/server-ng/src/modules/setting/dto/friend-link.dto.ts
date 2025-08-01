import { z } from 'zod';
import { commonSchemas } from '../../../shared/zod';

export const CreateFriendLinkSchema = z.object({
  name: commonSchemas.nonEmptyString.describe('友链名称'),
  url: z.string().pipe(z.url()).describe('友链地址'),
  description: z.string().optional().describe('友链描述'),
  avatar: z.string().pipe(z.url()).optional().describe('友链头像'),
});

export const UpdateFriendLinkSchema = CreateFriendLinkSchema;

export type CreateFriendLinkDto = z.infer<typeof CreateFriendLinkSchema>;
export type UpdateFriendLinkDto = z.infer<typeof UpdateFriendLinkSchema>;
