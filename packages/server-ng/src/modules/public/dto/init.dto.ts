import { z } from 'zod';

import { CreateUserSchema } from '../../user/dto/create-user.dto';

// Restrict admin creation payload and force type to 'admin'
export const InitAdminSchema = CreateUserSchema.pick({
  username: true,
  password: true,
  nickname: true,
  email: true,
  avatar: true,
})
  .partial({ nickname: true, email: true, avatar: true })
  .extend({ type: z.literal('admin').optional() });

export const InitSiteInfoSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .optional();

export const InitCmsRequestSchema = z.object({
  admin: InitAdminSchema,
  siteInfo: InitSiteInfoSchema,
});

export const InitCmsResponseSchema = z.object({
  initialized: z.literal(true),
  admin: z.object({ id: z.number().int(), username: z.string() }),
  siteInfo: z
    .object({
      title: z.string(),
      description: z.string(),
      author: z.string(),
      keywords: z.array(z.string()),
    })
    .optional(),
});

export type InitCmsRequestDto = z.infer<typeof InitCmsRequestSchema>;
export type InitCmsResponseDto = z.infer<typeof InitCmsResponseSchema>;
