import { z } from "zod";

// ── Navigation items ──────────────────────────────────────────────────

export const NavItemSchema = z
  .object({
    name: z.string(),
    value: z.string(),
    level: z.number(),
  })
  .strict();
export type NavItem = z.infer<typeof NavItemSchema>;

// ── Friend links ──────────────────────────────────────────────────────

export const LinkItemSchema = z
  .object({
    name: z.string(),
    url: z.string(),
    desc: z.string().optional(),
    logo: z.string().optional(),
  })
  .strict();
export type LinkItem = z.infer<typeof LinkItemSchema>;

// ── Social links ──────────────────────────────────────────────────────
export const SocialItemSchema = z
  .object({
    type: z.string(),
    value: z.string(),
  })
  .strict();
export type SocialItem = z.infer<typeof SocialItemSchema>;

// ── Reward QR codes ───────────────────────────────────────────────────
export const RewardItemSchema = z
  .object({
    name: z.string(),
    value: z.string(),
  })
  .strict();
export type RewardItem = z.infer<typeof RewardItemSchema>;

// ── Media normalization config ────────────────────────────────────────

export const MediaConfigSchema = z
  .object({
    enabled: z.boolean(),
    targetFormat: z.enum(["webp", "avif", "preserve"]),
    quality: z.number().int().min(1).max(100),
  })
  .strict();
export type MediaConfig = z.infer<typeof MediaConfigSchema>;

// ── Comments provider config (discriminated union) ────────────────────

export const CommentsProviderSchema = z.enum([
  "disabled",
  "artalk",
  "external",
]);
export const DisabledCommentsConfigSchema = z.object({}).strict();
export const ArtalkConfigSchema = z
  .object({
    server: z.string().min(1),
    site: z.string().optional(),
  })
  .strict();
export const ExternalConfigSchema = z
  .object({ customScript: z.string() })
  .strict();
export const CommentsProviderConfigSchemas = {
  disabled: DisabledCommentsConfigSchema,
  artalk: ArtalkConfigSchema,
  external: ExternalConfigSchema,
} as const;
// Consider using z.discriminatedUnion if a `provider` field is added to each config.
export const CommentsConfigSchema = z.union([
  CommentsProviderConfigSchemas.disabled,
  CommentsProviderConfigSchemas.artalk,
  CommentsProviderConfigSchemas.external,
]);
export type CommentsConfig = z.infer<typeof CommentsConfigSchema>;

export const DisplayOptionsSchema = z
  .object({
    showAdminButton: z.boolean(),
    showSubMenu: z.boolean(),
    subMenuOffset: z.number(),
    headerLeftContent: z.enum(["siteLogo", "siteName"]),
    showDonateInfo: z.boolean(),
    showFriends: z.boolean(),
    showCopyRight: z.boolean(),
    showDonateButton: z.boolean(),
    showDonateInAbout: z.boolean(),
    allowOpenHiddenPostByUrl: z.boolean(),
    showRSS: z.boolean(),
    openArticleLinksInNewWindow: z.boolean(),
    showExpirationReminder: z.boolean(),
    showEditButton: z.boolean(),
  })
  .strict();
export const OutputConfigSchema = z
  .object({
    format: z.enum(["markdown", "html"]),
    naming: z.string().optional(),
    include: z.array(z.string()).optional(),
    trigger: z.enum(["onUpdate", "manual"]),
  })
  .strict();
export const SyncConfigSchema = z
  .object({
    branch: z.string(),
    schedule: z.string(),
    sshKey: z.string().optional(),
  })
  .strict();
const S3OptionalFieldsSchema = z
  .object({
    bucket: z.string().trim().min(1).optional(),
    region: z.string().trim().min(1).optional(),
    endpoint: z.string().trim().min(1).optional(),
    accessKey: z.string().trim().min(1).optional(),
    secret: z.string().trim().min(1).optional(),
    forcePathStyle: z.boolean().optional(),
  })
  .strict();
export const S3ConfigSchema = z.union([
  S3OptionalFieldsSchema.extend({ enabled: z.literal(false) }).strict(),
  z
    .object({
      enabled: z.literal(true),
      bucket: z.string().trim().min(1),
      region: z.string().trim().min(1),
      endpoint: z.url(),
      accessKey: z.string().trim().min(1),
      secret: z.string().trim().min(1),
      forcePathStyle: z.boolean().optional(),
    })
    .strict(),
]);

// ── Routing rules ─────────────────────────────────────────────────────
// Matches Go UserRule struct

export const RouteRuleSchema = z
  .object({
    id: z.string(),
    type: z.enum(["proxy", "redirect", "rewrite", "block", "cache"]),
    from: z.string(),
    to: z.string(),
    code: z.number().optional(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .strict();
export type RouteRule = z.infer<typeof RouteRuleSchema>;
