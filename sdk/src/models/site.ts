import { z } from "zod";
import { IsoDateTimeSchema, SystemFieldsSchema } from "./common";
import {
  NavItemSchema,
  LinkItemSchema,
  SocialItemSchema,
  RewardItemSchema,
  MediaConfigSchema,
  CommentsConfigSchema,
  CommentsProviderSchema,
  CommentsProviderConfigSchemas,
  RouteRuleSchema,
  DisplayOptionsSchema,
  OutputConfigSchema,
  SyncConfigSchema,
  S3ConfigSchema,
} from "./fields";

// ── Select enums ──────────────────────────────────────────────────────

const PaletteMigrationModeSchema = z
  .enum(["keep", "silent", "prompt"])
  .default("keep");

// ── Site schema ───────────────────────────────────────────────────────

const SiteFieldsSchema = SystemFieldsSchema.extend({
  // Core text fields
  siteName: z.string().optional(),
  siteDesc: z.string().optional(),
  siteLogo: z.string().optional(),
  siteLogoDark: z.string().optional(),
  favicon: z.string().optional(),
  author: z.string().optional(),
  authorLogo: z.string().optional(),
  authorLogoDark: z.string().optional(),
  since: IsoDateTimeSchema.optional(),
  baseUrl: z.string().optional(),

  // Palette & dark mode
  palette: z.string().optional(),
  activeTheme: z.string().optional(),
  paletteMigrationMode: PaletteMigrationModeSchema.optional(),
  customCss: z.string().optional(),
  customHead: z.string().optional(),
  customHtml: z.string().optional(),
  customScript: z.string().optional(),
  watermarkText: z.string().optional(),
  enableWatermark: z.boolean().optional(),

  // Copyright & about
  copyrightAgreement: z.string().optional(),
  aboutContent: z.string().optional(),
  aboutUpdatedAt: IsoDateTimeSchema.optional(),

  // Auth page
  authDesc: z.string().optional(),

  // Analytics
  analyticsScript: z.string().optional(),
  baiduAnalysisId: z.string().optional(),
  gaAnalysisId: z.string().optional(),

  // Beian (ICP filing)
  beianNumber: z.string().optional(),
  beianUrl: z.string().optional(),
  gaBeianNumber: z.string().optional(),
  gaBeianUrl: z.string().optional(),
  gaBeianLogoUrl: z.string().optional(),

  // Payments
  payAliPay: z.string().optional(),
  payAliPayDark: z.string().optional(),
  payWechat: z.string().optional(),
  payWechatDark: z.string().optional(),

  // Comments
  commentsProvider: CommentsProviderSchema.optional(),
  commentsConfig: CommentsConfigSchema.optional(),

  // Revision history
  revisionsEnabled: z.boolean().optional(),
  revisionsRetention: z.number().int().nonnegative().optional(),

  // Caddy / TLS
  caddyLastError: z.string().optional(),
  caddyLogLevel: z.string().optional(),
  httpsRedirect: z.boolean().optional(),
  allowedDomains: z.array(z.string()).nullable().optional(),

  // Output / sync
  outputEnabled: z.boolean().optional(),
  outputDest: z.string().optional(),
  outputConfig: OutputConfigSchema.nullable().optional(),
  syncEnabled: z.boolean().optional(),
  syncRemote: z.string().optional(),
  syncConfig: SyncConfigSchema.nullable().optional(),
  s3Config: S3ConfigSchema.nullable().optional(),

  // Media
  mediaConfig: MediaConfigSchema.nullable().optional(),

  // Display options
  displayOptions: DisplayOptionsSchema.nullable().optional(),

  // Navigation, links, socials, rewards, routing
  nav: z.array(NavItemSchema).nullable().optional(),
  links: z.array(LinkItemSchema).nullable().optional(),
  socials: z.array(SocialItemSchema).nullable().optional(),
  rewards: z.array(RewardItemSchema).nullable().optional(),
  routing: z.array(RouteRuleSchema).nullable().optional(),
  routingAllowlist: z.array(z.string()).nullable().optional(),
});

// Keep the two comment fields flat for the PocketBase record shape, while
// expressing their cross-field contract as a data-only union. This avoids a
// runtime superRefine callback so native schema exporters can validate it.
const CommentsBindingSchema = z.union([
  z
    .object({
      commentsProvider: z.literal("disabled"),
      commentsConfig: CommentsProviderConfigSchemas.disabled,
    })
    .passthrough(),
  z
    .object({
      commentsProvider: z.literal("artalk"),
      commentsConfig: CommentsProviderConfigSchemas.artalk,
    })
    .passthrough(),
  z
    .object({
      commentsProvider: z.literal("external"),
      commentsConfig: CommentsProviderConfigSchemas.external,
    })
    .passthrough(),
  z
    .object({
      commentsProvider: z.literal(undefined).optional(),
    })
    .passthrough(),
]);

export const SiteSchema = SiteFieldsSchema.and(CommentsBindingSchema);
export type Site = z.infer<typeof SiteSchema>;
