import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { commonSchemas } from '../../../shared/zod';

export const CreateFriendLinkSchema = z.object({
  name: commonSchemas.nonEmptyString.describe('友链名称'),
  url: z.string().pipe(z.url()).describe('友链地址'),
  description: z.string().optional().describe('友链描述'),
  avatar: z.string().pipe(z.url()).optional().describe('友链头像'),
});

export const UpdateFriendLinkSchema = CreateFriendLinkSchema;

export class CreateFriendLinkDto extends createZodDto(CreateFriendLinkSchema) {}
export class UpdateFriendLinkDto extends createZodDto(UpdateFriendLinkSchema) {}
