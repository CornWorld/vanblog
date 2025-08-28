import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SocialLinkSchema = z.object({
  type: z.string().min(1),
  url: z.url(),
});

export const SocialLinksResponseSchema = z.array(SocialLinkSchema);

export const UpsertSocialLinkSchema = SocialLinkSchema; // same shape

export type SocialLink = z.infer<typeof SocialLinkSchema>;

export class SocialLinkDto extends createZodDto(SocialLinkSchema) {}
export class SocialLinksResponseDto extends createZodDto(SocialLinksResponseSchema) {}
export class UpsertSocialLinkDto extends createZodDto(UpsertSocialLinkSchema) {}
