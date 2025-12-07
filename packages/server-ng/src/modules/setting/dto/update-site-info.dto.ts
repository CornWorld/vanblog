import { c } from '@vanblog/shared';
import { z } from 'zod';

export const UpdateSiteInfoSchema = z.object({
  siteName: c.nonEmptyString.max(100, '站点名称过长'),
  siteDescription: z.string().optional(),
  siteKeywords: z.string().optional(),
  siteLogo: z.string().optional(),
  siteFavicon: z.string().optional(),
  siteUrl: c.url.optional(),
  authorName: z.string().optional(),
  authorEmail: c.email.optional(),
  authorAvatar: z.string().optional(),
  authorBio: z.string().optional(),
  icp: z.string().optional(),
  gaId: z.string().optional(),
  baiduId: z.string().optional(),
});

export type UpdateSiteInfoDto = z.infer<typeof UpdateSiteInfoSchema>;
