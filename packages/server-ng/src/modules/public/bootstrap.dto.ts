import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { RewardInfoSchema } from '../reward/reward.schema';
import { CreateFriendLinkSchema } from '../setting/dto/friend-link.dto';
import { SocialLinkArraySchema } from '../social-links/social-links.schema';

// Directly reuse base schemas from feature modules
const FriendLinkArraySchema = z.array(
  CreateFriendLinkSchema.pick({ name: true, url: true, description: true, avatar: true }),
);

export const PublicBootstrapResponseSchema = z.object({
  version: z.string(),
  tags: z.array(z.string()),
  totalArticles: z.number(),
  totalWordCount: z.number(),
  siteInfo: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    keywords: z.array(z.string()),
  }),
  navigation: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      icon: z.string().optional(),
      external: z.boolean().optional(),
      children: z.lazy(() => z.array(z.any())).optional(),
    }),
  ),
  friendLinks: FriendLinkArraySchema,
  socialLinks: SocialLinkArraySchema,
  rewards: z.array(RewardInfoSchema),
  categories: z.array(z.string()),
  walineConfig: z
    .object({
      serverURL: z.string().optional(),
    })
    .optional(),
});

export class PublicBootstrapResponseDto extends createZodDto(PublicBootstrapResponseSchema) {}
