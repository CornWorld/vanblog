import { z } from 'zod';

export const commonSchemas = {
  id: z.number().int().positive('ID must be a positive integer').describe('Unique identifier'),

  nonEmptyString: z.string().min(1, 'String cannot be empty').describe('Non-empty string value'),

  positiveInt: z
    .number()
    .int()
    .positive('Must be a positive integer')
    .describe('Positive integer value'),

  nonNegativeInt: z
    .number()
    .int()
    .min(0, 'Must be a non-negative integer')
    .describe('Non-negative integer value'),

  page: z
    .number()
    .int()
    .min(1, 'Page must be at least 1')
    .describe('Page number for pagination')
    .default(1),

  pageSize: z
    .number()
    .int()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100')
    .describe('Number of items per page')
    .default(10),

  url: z.string().url('Invalid URL format').describe('URL string'),

  email: z.string().email('Invalid email format').describe('Email address'),
};

export const UpdateSiteInfoSchema = z.object({
  siteName: commonSchemas.nonEmptyString.max(100, '站点名称过长'),
  siteDescription: z.string().optional(),
  siteKeywords: z.string().optional(),
  siteLogo: z.string().optional(),
  siteFavicon: z.string().optional(),
  siteUrl: commonSchemas.url.optional(),
  authorName: z.string().optional(),
  authorEmail: commonSchemas.email.optional(),
  authorAvatar: z.string().optional(),
  authorBio: z.string().optional(),
  icp: z.string().optional(),
  gaId: z.string().optional(),
  baiduId: z.string().optional(),
});

export type UpdateSiteInfo = z.infer<typeof UpdateSiteInfoSchema>;

export const SiteInfoSchema = z.object({
  title: z.string(),
  description: z.string(),
  author: z.string(),
  keywords: z.array(z.string()),
});

export type SiteInfo = z.infer<typeof SiteInfoSchema>;
