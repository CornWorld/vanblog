/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * Pure Zod schemas decoupled from drizzle-orm dependencies.
 * Source: src/runtime/schema.ts
 *
 * Regenerate: pnpm --filter @vanblog/shared generate-schemas
 * Generated: 2025-12-09T15:56:26.216Z
 */

import { z } from 'zod';

export const Analytics = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  type: z.string(),
  path: z.string().nullable(),
  referrer: z.string().nullable(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  data: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable(),
  createdAt: z.string(),
});

export const Article = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  title: z.string(),
  content: z.string(),
  pathname: z.string().nullable(),
  tags: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable(),
  category: z.string().nullable(),
  author: z.string(),
  top: z.number().min(-9007199254740991).max(9007199254740991).nullable(),
  hidden: z.boolean().nullable(),
  private: z.boolean().nullable(),
  password: z.string().nullable(),
  viewer: z.number().min(-9007199254740991).max(9007199254740991).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ArticleList = z.object({
  items: z.array(
    z.object({
      id: z.number().min(-9007199254740991).max(9007199254740991),
      title: z.string(),
      content: z.string(),
      pathname: z.string().nullable(),
      tags: z
        .union([
          z.union([z.string(), z.number(), z.boolean(), z.null()]),
          z.record(z.string(), z.any()),
          z.array(z.any()),
        ])
        .nullable(),
      category: z.string().nullable(),
      author: z.string(),
      top: z.number().min(-9007199254740991).max(9007199254740991).nullable(),
      hidden: z.boolean().nullable(),
      private: z.boolean().nullable(),
      password: z.string().nullable(),
      viewer: z.number().min(-9007199254740991).max(9007199254740991).nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const ArticlePatch = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  pathname: z
    .string()
    .regex(/^[a-zA-Z0-9-_/]+$/)
    .optional(),
  tags: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable()
    .optional(),
  category: z.string().nullable().optional(),
  author: z.string().optional(),
  top: z.number().min(-9007199254740991).max(9007199254740991).nullable().optional(),
  hidden: z.boolean().nullable().optional(),
  private: z.boolean().nullable().optional(),
  password: z.string().nullable().optional(),
  viewer: z.number().min(-9007199254740991).max(9007199254740991).nullable().optional(),
});

export const ArticleQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  author: z.string().optional(),
  hidden: z.coerce.boolean().optional(),
  private: z.coerce.boolean().optional(),
});

export const ArticleReq = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  pathname: z
    .string()
    .regex(/^[a-zA-Z0-9-_/]+$/)
    .optional(),
  tags: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable()
    .optional(),
  category: z.string().nullable().optional(),
  author: z.string().min(1),
  top: z.number().min(-9007199254740991).max(9007199254740991).nullable().optional(),
  hidden: z.boolean().nullable().optional(),
  private: z.boolean().nullable().optional(),
  password: z.string().nullable().optional(),
});

export const Category = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  name: z.string(),
  slug: z.string().nullable(),
  description: z.string().nullable(),
  private: z.boolean().nullable(),
  password: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  count: z.number().optional(),
});

export const CategoryPatch = z.object({
  name: z.string().min(1).max(50).optional(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9-_]+$/)
    .optional(),
  description: z.string().nullable().optional(),
  private: z.boolean().nullable().optional(),
  password: z.string().nullable().optional(),
});

export const CategoryReq = z.object({
  name: z.string().min(1).max(50),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9-_]+$/)
    .optional(),
  description: z.string().nullable().optional(),
  private: z.boolean().nullable().optional(),
  password: z.string().nullable().optional(),
});

export const CustomPage = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  title: z.string(),
  pathname: z.string(),
  content: z.string(),
  type: z.enum(['html', 'markdown']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CustomPagePatch = z.object({
  title: z.string().min(1).max(200).optional(),
  pathname: z
    .string()
    .regex(/^[a-zA-Z0-9-_/]+$/)
    .optional(),
  content: z.string().min(1).optional(),
  type: z.enum(['html', 'markdown']).optional(),
});

export const CustomPageReq = z.object({
  title: z.string().min(1).max(200),
  pathname: z.string().regex(/^[a-zA-Z0-9-_/]+$/),
  content: z.string().min(1),
  type: z.enum(['html', 'markdown']).optional(),
});

export const DeleteResponse = z.object({
  success: z.boolean(),
});

export const Draft = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  title: z.string(),
  content: z.string(),
  pathname: z.string().nullable(),
  tags: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable(),
  category: z.string().nullable(),
  author: z.string(),
  version: z.number().min(-9007199254740991).max(9007199254740991),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DraftList = z.object({
  items: z.array(
    z.object({
      id: z.number().min(-9007199254740991).max(9007199254740991),
      title: z.string(),
      content: z.string(),
      pathname: z.string().nullable(),
      tags: z
        .union([
          z.union([z.string(), z.number(), z.boolean(), z.null()]),
          z.record(z.string(), z.any()),
          z.array(z.any()),
        ])
        .nullable(),
      category: z.string().nullable(),
      author: z.string(),
      version: z.number().min(-9007199254740991).max(9007199254740991),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const DraftPatch = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  pathname: z
    .string()
    .regex(/^[a-zA-Z0-9-_/]+$/)
    .optional(),
  tags: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable()
    .optional(),
  category: z.string().nullable().optional(),
  author: z.string().optional(),
  version: z.number().min(-9007199254740991).max(9007199254740991).optional(),
});

export const DraftReq = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  pathname: z
    .string()
    .regex(/^[a-zA-Z0-9-_/]+$/)
    .optional(),
  tags: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable()
    .optional(),
  category: z.string().nullable().optional(),
  author: z.string().min(1),
});

export const DraftVersion = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  draftId: z.number().min(-9007199254740991).max(9007199254740991),
  version: z.number().min(-9007199254740991).max(9007199254740991),
  title: z.string(),
  content: z.string(),
  pathname: z.string().nullable(),
  tags: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable(),
  category: z.string().nullable(),
  author: z.string(),
  createdAt: z.string(),
});

export const LoginLog = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  username: z.string(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  success: z.boolean(),
  message: z.string().nullable(),
  createdAt: z.string(),
});

export const PaginationQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const PasswordVerifyReq = z.object({
  password: z.string().min(1),
});

export const PasswordVerifyResp = z.object({
  valid: z.boolean(),
  content: z.string().optional(),
});

export const PermissionGroup = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  name: z.string(),
  description: z.string().nullable(),
  permissions: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable(),
  isActive: z.boolean().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PermissionGroupPatch = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  permissions: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable()
    .optional(),
  isActive: z.boolean().nullable().optional(),
});

export const PermissionGroupReq = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  permissions: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable()
    .optional(),
  isActive: z.boolean().nullable().optional(),
});

export const PermissionNode = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  name: z.string(),
  description: z.string().nullable(),
  module: z.string(),
  isActive: z.boolean().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PermissionNodePatch = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  module: z.string().min(1).max(50).optional(),
  isActive: z.boolean().nullable().optional(),
});

export const PermissionNodeReq = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  module: z.string().min(1).max(50),
  isActive: z.boolean().nullable().optional(),
});

export const PluginData = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  pluginId: z.string(),
  key: z.string(),
  value: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PluginDataPatch = z.object({
  pluginId: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  value: z.string().nullable().optional(),
});

export const PluginDataReq = z.object({
  pluginId: z.string().min(1),
  key: z.string().min(1),
  value: z.string().nullable().optional(),
});

export const SearchQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  keyword: z.string().optional(),
});

export const SiteMeta = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  key: z.string(),
  value: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SiteMetaPatch = z.object({
  key: z.string().min(1).max(100).optional(),
  value: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable()
    .optional(),
});

export const SiteMetaReq = z.object({
  key: z.string().min(1).max(100),
  value: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable()
    .optional(),
});

export const StaticFile = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  filename: z.string(),
  path: z.string(),
  size: z.number().min(-9007199254740991).max(9007199254740991),
  mimeType: z.string().nullable(),
  width: z.number().min(-9007199254740991).max(9007199254740991).nullable(),
  height: z.number().min(-9007199254740991).max(9007199254740991).nullable(),
  hash: z.string().nullable(),
  provider: z.string().nullable(),
  createdAt: z.string(),
});

export const StaticFileReq = z.object({
  filename: z.string().min(1),
  path: z.string().min(1),
  size: z.number().positive(),
  mimeType: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.]*$/)
    .optional(),
  width: z.number().min(-9007199254740991).max(9007199254740991).nullable().optional(),
  height: z.number().min(-9007199254740991).max(9007199254740991).nullable().optional(),
  hash: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
});

export const SuccessResponse = z.object({
  success: z.literal(true),
});

export const Tag = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  name: z.string(),
  slug: z.string().nullable(),
  createdAt: z.string(),
  count: z.number().optional(),
});

export const TagPatch = z.object({
  name: z.string().min(1).max(30).optional(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9-_]+$/)
    .optional(),
});

export const TagReq = z.object({
  name: z.string().min(1).max(30),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9-_]+$/)
    .optional(),
});

export const User = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  username: z.string(),
  nickname: z.string().nullable(),
  email: z.string().nullable(),
  avatar: z.string().nullable(),
  type: z.enum(['admin', 'editor', 'author', 'subscriber', 'viewer']),
  permissions: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const UserPatch = z.object({
  username: z.string().min(3).max(20).optional(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^a-zA-Z0-9]/)
    .optional(),
  nickname: z.string().nullable().optional(),
  email: z.string().email().optional(),
  avatar: z.string().nullable().optional(),
  type: z.enum(['admin', 'editor', 'author', 'subscriber', 'viewer']).optional(),
  permissions: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable()
    .optional(),
});

export const UserReq = z.object({
  username: z.string().min(3).max(20),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^a-zA-Z0-9]/),
  nickname: z.string().nullable().optional(),
  email: z.string().email().optional(),
  avatar: z.string().nullable().optional(),
  type: z.enum(['admin', 'editor', 'author', 'subscriber', 'viewer']).optional(),
  permissions: z
    .union([
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
      z.record(z.string(), z.any()),
      z.array(z.any()),
    ])
    .nullable()
    .optional(),
});

export const Webhook = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  name: z.string(),
  url: z.string(),
  events: z.union([
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
    z.record(z.string(), z.any()),
    z.array(z.any()),
  ]),
  secret: z.string().nullable(),
  active: z.boolean(),
  retryCount: z.number().min(-9007199254740991).max(9007199254740991),
  timeout: z.number().min(-9007199254740991).max(9007199254740991),
  lastTriggered: z.string().nullable(),
  lastStatus: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WebhookLog = z.object({
  id: z.number().min(-9007199254740991).max(9007199254740991),
  webhookId: z.number().min(-9007199254740991).max(9007199254740991),
  event: z.string(),
  payload: z.union([
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
    z.record(z.string(), z.any()),
    z.array(z.any()),
  ]),
  status: z.string(),
  responseCode: z.number().min(-9007199254740991).max(9007199254740991).nullable(),
  responseBody: z.string().nullable(),
  error: z.string().nullable(),
  duration: z.number().min(-9007199254740991).max(9007199254740991).nullable(),
  createdAt: z.string(),
});

export const WebhookPatch = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().min(1).optional(),
  events: z.array(z.string()).min(1).optional(),
  secret: z.string().nullable().optional(),
  active: z.boolean().optional(),
  retryCount: z.number().min(-9007199254740991).max(9007199254740991).optional(),
  timeout: z.number().min(-9007199254740991).max(9007199254740991).optional(),
});

export const WebhookReq = z.object({
  name: z.string().min(1).max(100),
  url: z.string().min(1),
  events: z.array(z.string()).min(1),
  secret: z.string().nullable().optional(),
  active: z.boolean().optional(),
  retryCount: z.number().min(-9007199254740991).max(9007199254740991).optional(),
  timeout: z.number().min(-9007199254740991).max(9007199254740991).optional(),
});

// Type exports
export type Analytics = z.infer<typeof Analytics>;
export type Article = z.infer<typeof Article>;
export type ArticleList = z.infer<typeof ArticleList>;
export type ArticlePatch = z.infer<typeof ArticlePatch>;
export type ArticleQuery = z.infer<typeof ArticleQuery>;
export type ArticleReq = z.infer<typeof ArticleReq>;
export type Category = z.infer<typeof Category>;
export type CategoryPatch = z.infer<typeof CategoryPatch>;
export type CategoryReq = z.infer<typeof CategoryReq>;
export type CustomPage = z.infer<typeof CustomPage>;
export type CustomPagePatch = z.infer<typeof CustomPagePatch>;
export type CustomPageReq = z.infer<typeof CustomPageReq>;
export type DeleteResponse = z.infer<typeof DeleteResponse>;
export type Draft = z.infer<typeof Draft>;
export type DraftList = z.infer<typeof DraftList>;
export type DraftPatch = z.infer<typeof DraftPatch>;
export type DraftReq = z.infer<typeof DraftReq>;
export type DraftVersion = z.infer<typeof DraftVersion>;
export type LoginLog = z.infer<typeof LoginLog>;
export type PaginationQuery = z.infer<typeof PaginationQuery>;
export type PasswordVerifyReq = z.infer<typeof PasswordVerifyReq>;
export type PasswordVerifyResp = z.infer<typeof PasswordVerifyResp>;
export type PermissionGroup = z.infer<typeof PermissionGroup>;
export type PermissionGroupPatch = z.infer<typeof PermissionGroupPatch>;
export type PermissionGroupReq = z.infer<typeof PermissionGroupReq>;
export type PermissionNode = z.infer<typeof PermissionNode>;
export type PermissionNodePatch = z.infer<typeof PermissionNodePatch>;
export type PermissionNodeReq = z.infer<typeof PermissionNodeReq>;
export type PluginData = z.infer<typeof PluginData>;
export type PluginDataPatch = z.infer<typeof PluginDataPatch>;
export type PluginDataReq = z.infer<typeof PluginDataReq>;
export type SearchQuery = z.infer<typeof SearchQuery>;
export type SiteMeta = z.infer<typeof SiteMeta>;
export type SiteMetaPatch = z.infer<typeof SiteMetaPatch>;
export type SiteMetaReq = z.infer<typeof SiteMetaReq>;
export type StaticFile = z.infer<typeof StaticFile>;
export type StaticFileReq = z.infer<typeof StaticFileReq>;
export type SuccessResponse = z.infer<typeof SuccessResponse>;
export type Tag = z.infer<typeof Tag>;
export type TagPatch = z.infer<typeof TagPatch>;
export type TagReq = z.infer<typeof TagReq>;
export type User = z.infer<typeof User>;
export type UserPatch = z.infer<typeof UserPatch>;
export type UserReq = z.infer<typeof UserReq>;
export type Webhook = z.infer<typeof Webhook>;
export type WebhookLog = z.infer<typeof WebhookLog>;
export type WebhookPatch = z.infer<typeof WebhookPatch>;
export type WebhookReq = z.infer<typeof WebhookReq>;
