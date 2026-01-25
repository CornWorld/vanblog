import { z } from 'zod';
import { dataCodec, dateStr } from './date-codecs.js';
import { Tag as TagSchema } from './runtime/schema.js';

export const c = {
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
  name: c.nonEmptyString.describe('友链名称'),
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

export const SocialTypeEnum = z.enum([
  'bilibili',
  'email',
  'github',
  'gitee',
  'wechat',
  'wechat-dark',
]);

export type SocialType = z.infer<typeof SocialTypeEnum>;

export const SocialItemSchema = z.object({
  type: SocialTypeEnum,
  value: z.string(),
  updatedAt: dateStr,
});

export type SocialItem = z.infer<typeof SocialItemSchema>;

export const CreateSocialSchema = z.object({
  type: SocialTypeEnum,
  value: z.string(),
});

export type CreateSocial = z.infer<typeof CreateSocialSchema>;

export const UpdateSocialSchema = CreateSocialSchema;
export type UpdateSocial = z.infer<typeof UpdateSocialSchema>;

export const SocialTypeInfoSchema = z.object({
  label: z.string(),
  value: SocialTypeEnum,
});

export type SocialTypeInfo = z.infer<typeof SocialTypeInfoSchema>;

export const WalineSettingSchema = z.object({
  'smtp.enabled': z.boolean().default(false),
  'smtp.port': z.number().default(465),
  'smtp.host': z.string().default(''),
  'smtp.user': z.string().default(''),
  'smtp.password': z.string().default(''),
  'sender.name': z.string().default(''),
  'sender.email': z.string().default(''),
  authorEmail: z.string().default(''),
  webhook: z.string().optional(),
  forceLoginComment: z.boolean().default(false),
  otherConfig: z.string().optional(),
  serverURL: z.string().optional(),
});

export type WalineSetting = z.infer<typeof WalineSettingSchema>;

export const UpdateWalineSettingSchema = WalineSettingSchema;
export type UpdateWalineSetting = z.infer<typeof UpdateWalineSettingSchema>;

export const ISRSettingSchema = z.object({
  mode: z.enum(['delay', 'onDemand']).default('onDemand'),
  delay: z.number().default(0),
});

export type ISRSetting = z.infer<typeof ISRSettingSchema>;

export const UpdateISRSettingSchema = ISRSettingSchema;
export type UpdateISRSetting = z.infer<typeof UpdateISRSettingSchema>;

export const LoginSettingSchema = z.object({
  enableMaxLoginRetry: z.boolean().default(false),
  maxRetryTimes: z.number().default(5),
  durationSeconds: z.number().default(300),
  expiresIn: z.number().default(7200),
});

export type LoginSetting = z.infer<typeof LoginSettingSchema>;

export const UpdateLoginSettingSchema = LoginSettingSchema;
export type UpdateLoginSetting = z.infer<typeof UpdateLoginSettingSchema>;

export const HttpsSettingSchema = z.object({
  redirect: z.boolean().default(false),
});

export type HttpsSetting = z.infer<typeof HttpsSettingSchema>;

export const UpdateHttpsSettingSchema = HttpsSettingSchema;
export type UpdateHttpsSetting = z.infer<typeof UpdateHttpsSettingSchema>;

export const StaticSettingSchema = z.object({
  storageType: z.enum(['picgo', 'local']).default('local'),
  picgoConfig: z.any().optional(),
  picgoPlugins: z.string().optional(),
  enableWaterMark: z.boolean().default(false),
  waterMarkText: z.string().optional(),
  enableWebp: z.boolean().default(true),
});

export type StaticSetting = z.infer<typeof StaticSettingSchema>;

export const UpdateStaticSettingSchema = StaticSettingSchema;
export type UpdateStaticSetting = z.infer<typeof UpdateStaticSettingSchema>;

export const RewardItemSchema = z.object({
  name: z.string(),
  value: z.string(),
  updatedAt: dateStr,
});

export type RewardItem = z.infer<typeof RewardItemSchema>;

export const CreateRewardSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export type CreateReward = z.infer<typeof CreateRewardSchema>;

export const UpdateRewardSchema = CreateRewardSchema;
export type UpdateReward = z.infer<typeof UpdateRewardSchema>;

export const CaddyLogSchema = z.string();
export const CaddyConfigSchema = z.string();

// Auth & User
export const LoginSchema = z.object({
  name: z.string(),
  password: z.string(),
});

// Note: UserSchema and User type are exported from runtime/schema.ts
// to avoid duplicate exports with contract.ts

export const UpdateUserSchema = z.object({
  nickname: z.string().optional(),
  avatar: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  oldPassword: z.string().optional(),
});

export const CreateCollaboratorSchema = z.object({
  name: z.string(),
  password: z.string(),
  nickname: z.string().optional(),
  permissions: z.array(z.string()),
});

export const UpdateCollaboratorSchema = z.object({
  id: z.number(),
  password: z.string().optional(),
  nickname: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

// Token
export const TokenSchema = z.object({
  _id: z.string(),
  name: z.string(),
  token: z.string(),
  createdAt: dateStr,
});

export const CreateTokenSchema = z.object({
  name: z.string(),
});

// Category & Tag
export const CategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  count: z.number().optional(),
  createdAt: dateStr,
  updatedAt: dateStr,
});

export const CreateCategorySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const UpdateCategorySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  password: z.string().optional(),
});

// Note: TagSchema and Tag type are exported from runtime/schema.ts
// to avoid duplicate exports with contract.ts

export const CreateTagSchema = z.object({
  name: z.string(),
});

export const UpdateTagSchema = z.object({
  name: z.string(),
});

// Article & Draft
export const ArticleSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(TagSchema).optional(),
  views: z.number().default(0),
  likes: z.number().default(0),
  isTop: z.boolean().default(false),
  isHot: z.boolean().default(false),
  pubTime: dateStr,
  createdAt: dateStr,
  updatedAt: dateStr,
  private: z.boolean().default(false),
  password: z.string().optional(),
  toc: z.string().optional(),
});

export const CreateArticleSchema = z.object({
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isTop: z.boolean().optional(),
  isHot: z.boolean().optional(),
  pubTime: dateStr.optional(),
  private: z.boolean().optional(),
  password: z.string().optional(),
});

export const UpdateArticleSchema = CreateArticleSchema.partial();

export const DraftSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: dateStr,
  updatedAt: dateStr,
});

export const CreateDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateDraftSchema = CreateDraftSchema.partial();

// Media
export const MediaSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  path: z.string(),
  type: z.string(),
  size: z.number(),
  createdAt: dateStr,
});

// Custom Page
export const CustomPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  createdAt: dateStr,
  updatedAt: dateStr,
});

export const CreateCustomPageSchema = z.object({
  name: z.string(),
  path: z.string(),
});

export const UpdateCustomPageSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  path: z.string().optional(),
});

export const PublicCustomPageSchema = z.object({
  name: z.string(),
  path: z.string(),
  html: z.string(),
});

export const CustomPageListSchema = z.object({
  name: z.string(),
  path: z.string(),
});

// Pipeline
export const PipelineSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  lastRun: dateStr.optional(),
});

export const CreatePipelineSchema = z.object({
  name: z.string(),
  config: z.any(),
});

export const UpdatePipelineSchema = z.object({
  name: z.string().optional(),
  config: z.any().optional(),
});

// Analytics
export const AnalyticsOverviewSchema = z.object({
  totalPageviews: z.number(),
  totalVisitors: z.number(),
  todayPageviews: z.number(),
  todayVisitors: z.number(),
});

export const AnalyticsLogSchema = z.object({
  id: z.number(),
  type: z.string(),
  content: z.string(),
  createdAt: dateStr,
});

// Meta
export const VersionInfoSchema = z.object({
  version: z.string(),
  latestVersion: z.string(),
  needUpdate: z.boolean(),
});

export const InitSchema = z.object({
  username: z.string(),
  password: z.string(),
  email: z.string(),
});

// Timeline
export const TimelineArticleInputSchema = z.object({
  id: z.number(),
  title: z.string(),
  pathname: z.string().nullable(),
  tags: z.array(z.string()),
  category: z.string().nullable(),
  author: z.string().nullable(),
  top: z.number().nullable(),
  hidden: z.boolean(),
  private: z.boolean(),
  viewer: z.number(),
  createdAt: dateStr,
  updatedAt: dateStr,
  pubTime: dateStr,
});

export type TimelineArticleInput = z.input<typeof TimelineArticleInputSchema>;

export type TimelineArticleDecoded = Omit<
  z.output<typeof TimelineArticleInputSchema>,
  'createdAt' | 'updatedAt' | 'pubTime'
> & {
  createdAt: import('dayjs').Dayjs;
  updatedAt: import('dayjs').Dayjs;
  pubTime: import('dayjs').Dayjs;
};

export const TimelineArticleOutputSchema = z.object({
  id: z.number(),
  title: z.string(),
  pathname: z.string().nullable(),
  tags: z.array(z.string()),
  category: z.string().nullable(),
  author: z.string().nullable(),
  top: z.number().nullable(),
  hidden: z.boolean(),
  private: z.boolean(),
  viewer: z.number(),
  createdAt: dateStr,
  updatedAt: dateStr,
  pubTime: dateStr,
});

export type TimelineArticleOutput = z.output<typeof TimelineArticleOutputSchema>;

export function decodeTimelineArticle(input: TimelineArticleInput): TimelineArticleDecoded {
  return {
    ...input,
    createdAt: dataCodec.decode(input.createdAt),
    updatedAt: dataCodec.decode(input.updatedAt),
    pubTime: dataCodec.decode(input.pubTime),
  } as TimelineArticleDecoded;
}

export function encodeTimelineArticle(decoded: TimelineArticleDecoded): TimelineArticleInput {
  return {
    ...decoded,
    createdAt: dataCodec.encode(decoded.createdAt),
    updatedAt: dataCodec.encode(decoded.updatedAt),
    pubTime: dataCodec.encode(decoded.pubTime),
  } as TimelineArticleInput;
}

export type TimelineArticleDbRow = {
  id: number;
  title: string;
  pathname: string | null;
  tags: string[] | null;
  category: string | null;
  author: string | null;
  top: number | null;
  hidden: boolean | null;
  private: boolean | null;
  viewer: number | null;
  createdAt: string;
  updatedAt: string;
  pubTime: string;
};

export function toTimelineArticleInputFromDb(row: TimelineArticleDbRow): TimelineArticleInput {
  return {
    id: row.id,
    title: row.title,
    pathname: row.pathname,
    tags: row.tags ?? [],
    category: row.category,
    author: row.author,
    top: row.top,
    hidden: !!row.hidden,
    private: !!row.private,
    viewer: row.viewer ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    pubTime: row.pubTime,
  } satisfies TimelineArticleInput;
}
