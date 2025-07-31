import { z } from 'zod';

export const SocialLinkSchema = z.object({
  type: z.string(),
  url: z.string(),
});

export const SocialLinkArraySchema = z.array(SocialLinkSchema);

export type SocialLink = z.infer<typeof SocialLinkSchema>;
