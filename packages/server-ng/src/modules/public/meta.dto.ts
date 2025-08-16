import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Reuse base schemas from existing modules to avoid duplication
import { RewardInfoSchema } from '../reward/reward.schema';
import { CreateFriendLinkSchema } from '../setting/dto/friend-link.dto';
import { SocialLinkSchema } from '../social-links/social-links.schema';

// Define MenuItem interface for recursive type
export interface MenuItem {
  id: number;
  name: string;
  value: string;
  level: number;
  children?: MenuItem[];
}

// Public social item builds on the base SocialLink's `type` and adds `value` + metadata
const SocialItemSchema = SocialLinkSchema.pick({ type: true }).extend({
  value: z.string(),
  updatedAt: z.string(),
  // Some clients may expect a dark variant URL for icons
  dark: z.string().optional(),
});

const MenuItemSchema: z.ZodType<MenuItem> = z.object({
  id: z.number(),
  name: z.string(),
  value: z.string(),
  level: z.number(),
  children: z.array(z.lazy(() => MenuItemSchema)).optional(),
});

// Reward items reuse RewardInfoSchema and append updatedAt
const DonateItemSchema = RewardInfoSchema.extend({
  updatedAt: z.string(),
});

// Friend link items reuse name/url from existing friend link schema
const LinkItemSchema = CreateFriendLinkSchema.pick({ name: true, url: true }).extend({
  desc: z.string(),
  logo: z.string(),
  updatedAt: z.string(),
});

const SiteInfoSchema = z.object({
  author: z.string(),
  authorDesc: z.string(),
  authorLogo: z.string(),
  authorLogoDark: z.string().optional(),
  siteLogo: z.string(),
  favicon: z.string(),
  siteName: z.string(),
  siteDesc: z.string(),
  beianNumber: z.string(),
  beianUrl: z.string(),
  gaBeianNumber: z.string(),
  gaBeianUrl: z.string(),
  gaBeianLogoUrl: z.string(),
  payAliPay: z.string(),
  payWechat: z.string(),
  payAliPayDark: z.string().optional(),
  payWechatDark: z.string().optional(),
  since: z.string(),
  baseUrl: z.string(),
  baiduAnalysisId: z.string().optional(),
  gaAnalysisId: z.string().optional(),
  siteLogoDark: z.string().optional(),
  copyrightAggreement: z.string(),
  showSubMenu: z.enum(['true', 'false']).optional(),
  showAdminButton: z.enum(['true', 'false']).optional(),
  headerLeftContent: z.enum(['siteLogo', 'siteName']).optional(),
  subMenuOffset: z.number().optional(),
  showDonateInfo: z.enum(['true', 'false']),
  showFriends: z.enum(['true', 'false']),
  enableComment: z.enum(['true', 'false']),
  defaultTheme: z.enum(['auto', 'light', 'dark']),
  showDonateInAbout: z.enum(['true', 'false']).optional(),
  enableCustomizing: z.enum(['true', 'false']),
  showDonateButton: z.enum(['true', 'false']),
  showCopyRight: z.enum(['true', 'false']),
  showRSS: z.enum(['true', 'false']),
  openArticleLinksInNewWindow: z.enum(['true', 'false']),
  showExpirationReminder: z.enum(['true', 'false']),
  showEditButton: z.enum(['true', 'false']),
});

const MetaPropsSchema = z.object({
  links: z.array(LinkItemSchema),
  socials: z.array(SocialItemSchema),
  rewards: z.array(DonateItemSchema),
  categories: z.array(z.string()),
  about: z.object({
    updatedAt: z.string(),
    content: z.string(),
  }),
  siteInfo: SiteInfoSchema,
});

const LayoutSchema = z.object({
  css: z.string().optional(),
  script: z.string().optional(),
  html: z.string().optional(),
  head: z
    .array(
      z.object({
        tag: z.string(),
        content: z.string().optional(),
        attributes: z.record(z.string(), z.string()).optional(),
      }),
    )
    .optional(),
});

export const PublicMetaResponseSchema = z.object({
  version: z.string(),
  tags: z.array(z.string()),
  totalArticles: z.number(),
  meta: MetaPropsSchema,
  menus: z.array(MenuItemSchema),
  totalWordCount: z.number(),
  layout: LayoutSchema.optional(),
  walineConfig: z
    .object({
      serverURL: z.string().optional(),
    })
    .optional(),
});

export class PublicMetaResponseDto extends createZodDto(PublicMetaResponseSchema) {}
