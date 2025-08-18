import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CreateFriendLinkSchema } from '../setting/dto/friend-link.dto';

// Directly reuse base schemas from feature modules
const FriendLinkArraySchema = z.array(
  CreateFriendLinkSchema.pick({ name: true, url: true, description: true, avatar: true }),
);

// Strict recursive navigation schema for public response
type NavigationPublic = {
  name: string;
  path: string;
  icon?: string;
  external?: boolean;
  children?: NavigationPublic[];
};
const NavigationSchema: z.ZodType<NavigationPublic> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    icon: z.string().optional(),
    external: z.boolean().optional(),
    children: z.array(NavigationSchema).optional(),
  }),
);

// Reward item schema/type for backward compatibility
export const RewardSchema = z.object({
  name: z.string(),
  value: z.string(),
  updatedAt: z.string().optional(),
});
export type RewardItem = z.infer<typeof RewardSchema>;

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
  navigation: z.array(NavigationSchema),
  friendLinks: FriendLinkArraySchema,
  socialLinks: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      icon: z.string().optional(),
    }),
  ),
  // Keep rewards for backward compatibility with v1/v2 clients and e2e contract
  rewards: z.array(RewardSchema),
  categories: z.array(z.string()),
  walineConfig: z
    .object({
      serverURL: z.string().optional(),
    })
    .optional(),
});

export class PublicBootstrapResponseDto extends createZodDto(PublicBootstrapResponseSchema) {}
