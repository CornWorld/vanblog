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

export const SiteLayoutSchema = z.object({
  showRecentPosts: z.boolean(),
  recentPostsCount: z.number(),
  showCategories: z.boolean(),
  showTags: z.boolean(),
  showArchive: z.boolean(),
  showAbout: z.boolean(),
  showSearch: z.boolean(),
});

export type SiteLayout = z.infer<typeof SiteLayoutSchema>;

export const UpdateLayoutSchema = z.object({
  showRecentPosts: z.boolean().describe('是否显示最近文章'),
  recentPostsCount: z.number().min(1).max(20).describe('最近文章数量'),
  showCategories: z.boolean().describe('是否显示分类'),
  showTags: z.boolean().describe('是否显示标签'),
  showArchive: z.boolean().describe('是否显示归档'),
  showAbout: z.boolean().describe('是否显示关于'),
  showSearch: z.boolean().describe('是否显示搜索'),
});

export type UpdateLayout = z.infer<typeof UpdateLayoutSchema>;

export const SiteThemeSchema = z.object({
  primaryColor: z.string(),
  darkMode: z.boolean(),
});

export type SiteTheme = z.infer<typeof SiteThemeSchema>;

export const UpdateThemeSchema = z.object({
  theme: z.string().min(1, '主题名称不能为空'),
  config: z.record(z.string(), z.unknown()).optional(),
  customCss: z.string().optional(),
  customJs: z.string().optional(),
  customHead: z.string().optional(),
  customFooter: z.string().optional(),
});

export type UpdateTheme = z.infer<typeof UpdateThemeSchema>;

export const FriendLinkSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  avatar: z.string().optional(),
  createTime: z.string(),
  updateTime: z.string(),
});

export type FriendLink = z.infer<typeof FriendLinkSchema>;

export const CreateFriendLinkSchema = z.object({
  name: commonSchemas.nonEmptyString.describe('友链名称'),
  url: z.string().url().describe('友链地址'),
  description: z.string().optional().describe('友链描述'),
  avatar: z.string().url().optional().describe('友链头像'),
});

export type CreateFriendLink = z.infer<typeof CreateFriendLinkSchema>;

export const UpdateFriendLinkSchema = CreateFriendLinkSchema;

export type UpdateFriendLink = z.infer<typeof UpdateFriendLinkSchema>;

export type NavigationItem = {
  id?: number;
  name: string;
  url: string;
  icon?: string;
  target: '_self' | '_blank';
  order: number;
  children?: NavigationItem[];
};

export const NavigationItemSchema: z.ZodType<NavigationItem> = z.lazy(() =>
  z.object({
    id: z.number().optional(),
    name: z.string().min(1, '导航名称不能为空'),
    url: z.string().min(1, '导航链接不能为空'),
    icon: z.string().optional(),
    target: z.enum(['_self', '_blank']).default('_self'),
    order: z.number().default(0),
    children: z.array(NavigationItemSchema).optional(),
  }),
) as unknown as z.ZodType<NavigationItem>;

export const UpdateNavigationSchema = z.object({
  items: z.array(NavigationItemSchema),
});

export type UpdateNavigation = z.infer<typeof UpdateNavigationSchema>;

export type Navigation = {
  name: string;
  path: string;
  icon?: string;
  external?: boolean;
  children?: Navigation[];
};

export const NavigationSchema: z.ZodType<Navigation> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    icon: z.string().optional(),
    external: z.boolean().optional(),
    children: z.array(NavigationSchema).optional(),
  }),
) as unknown as z.ZodType<Navigation>;

export const CustomCodeSchema = z.object({
  css: z.string().optional(),
  script: z.string().optional(),
  html: z.string().optional(),
  head: z.string().optional(),
});

export type CustomCode = z.infer<typeof CustomCodeSchema>;

export const UpdateCustomCodeSchema = CustomCodeSchema;
export type UpdateCustomCode = z.infer<typeof UpdateCustomCodeSchema>;

export const AboutInfoSchema = z.object({
  content: z.string(),
});

export type AboutInfo = z.infer<typeof AboutInfoSchema>;

export const UpdateAboutSchema = AboutInfoSchema;
export type UpdateAbout = z.infer<typeof UpdateAboutSchema>;
