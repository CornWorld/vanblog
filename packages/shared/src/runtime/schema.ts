/**
 * @file runtime/schema.ts
 *
 * VanBlog 类型系统核心 - 基于 Drizzle ORM 和 drizzle-zod 的 Schema 定义
 *
 * Core type system for VanBlog - Schema definitions based on Drizzle ORM and drizzle-zod
 *
 * ## 架构设计 (Architecture)
 *
 * 遵循 "单一类型来源 (Single Source of Truth)" 原则：
 * 1. Drizzle tables (db.ts) → 唯一的类型来源，使用 mode: 'json' 自动处理 JSON 序列化
 * 2. drizzle-zod → 自动生成 Zod schemas
 * 3. 本文件添加额外的验证逻辑（如密码强度、slug 格式）
 *
 * ## 命名规范 (Naming Convention)
 *
 * ### DB 层（前缀 `$`）
 * - `$Entity` - SELECT schema (从数据库读取)
 * - `$EntityIns` - INSERT schema (写入数据库)
 * - `$EntityUpd` - UPDATE schema (更新数据库)
 *
 * ### API 层（无前缀）
 * - `Entity` - API 响应 (通常是 $Entity 去除敏感字段)
 * - `EntityReq` - API 创建请求 (通常是 $EntityIns 去除自动生成字段)
 * - `EntityPatch` - API 更新请求 (通常是 $EntityUpd 去除自动生成字段)
 *
 * ## JSON 处理
 *
 * 数据库层使用 Drizzle 的 `mode: 'json'` 自动处理 JSON 序列化：
 * - 读取时：自动 JSON.parse
 * - 写入时：自动 JSON.stringify
 * - 无需手动 transform
 */
import { createSelectSchema, createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  users,
  articles,
  categories,
  tags,
  drafts,
  draftVersions,
  staticFiles,
  siteMeta,
  loginLogs,
  customPages,
  analytics,
  permissionNodes,
  permissionGroups,
  pluginData,
  webhooks,
  webhookLogs,
} from './db.js';

// ============================================================
// Common Schemas (for validation override)
// 通用 Schema（用于覆盖默认的验证行为）
// ============================================================

/**
 * 密码验证 schema - 强制要求包含大小写字母、数字和特殊字符
 *
 * Password validation schema - enforces strong password requirements
 */
const password = z
  .string()
  .min(8, '密码至少8个字符')
  .max(128, '密码最多128个字符')
  .regex(/[a-z]/, '密码必须包含至少一个小写字母')
  .regex(/[A-Z]/, '密码必须包含至少一个大写字母')
  .regex(/[0-9]/, '密码必须包含至少一个数字')
  .regex(/[^a-zA-Z0-9]/, '密码必须包含至少一个特殊字符');

/**
 * 邮箱验证 schema
 *
 * Email validation schema
 */
const emailSchema = z.string().email('请输入有效的邮箱地址');

/**
 * Slug 验证 schema - 仅允许字母、数字、连字符和下划线
 *
 * Slug validation schema - alphanumeric with hyphens and underscores only
 */
const slugSchema = z.string().regex(/^[a-zA-Z0-9-_]+$/, 'slug只能包含字母、数字、连字符和下划线');

/**
 * 路径验证 schema - 仅允许字母、数字、连字符、下划线和斜杠
 *
 * Pathname validation schema - alphanumeric with hyphens, underscores and slashes
 */
const pathnameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线');

// ============================================================
// USER
// 用户表相关 Schemas
// ============================================================

/**
 * $User - 数据库查询结果（SELECT）
 *
 * Database SELECT schema for users table.
 * JSON fields (permissions) are automatically handled by Drizzle mode: 'json'.
 */
export const $User = createSelectSchema(users).extend({
  permissions: z.array(z.string()).nullable(),
});

/**
 * $UserIns - 数据库插入（INSERT）
 *
 * Database INSERT schema for users table.
 */
export const $UserIns = createInsertSchema(users, {
  username: z.string().min(3, '用户名至少3个字符').max(20, '用户名最多20个字符'),
  password,
  email: emailSchema.optional(),
  permissions: z.array(z.string()).nullable().optional(),
});

/**
 * $UserUpd - 数据库更新（UPDATE）
 *
 * Database UPDATE schema for users table.
 */
export const $UserUpd = createUpdateSchema(users, {
  username: z.string().min(3).max(20).optional(),
  password: password.optional(),
  email: emailSchema.optional(),
  permissions: z.array(z.string()).nullable().optional(),
});

/**
 * User - API 响应（去除敏感字段）
 *
 * API response schema - excludes password field for security.
 * Nullable fields (nickname, avatar, email) are converted to optional for API compatibility.
 * Permissions field is guaranteed to be an array (null converted to []).
 */
export const User = $User.omit({ password: true }).extend({
  nickname: z.string().optional(),
  avatar: z.string().optional(),
  email: z.string().optional(),
  permissions: z.array(z.string()).default([]),
});

/**
 * UserReq - API 创建请求
 *
 * API create request schema - excludes auto-generated fields.
 */
export const UserReq = $UserIns.omit({ id: true, createdAt: true, updatedAt: true });

/**
 * UserPatch - API 更新请求
 *
 * API update request schema - excludes auto-generated fields.
 */
export const UserPatch = $UserUpd.omit({ id: true, createdAt: true, updatedAt: true });

// ============================================================
// ARTICLE
// ============================================================

export const $Article = createSelectSchema(articles);

export const $ArticleIns = createInsertSchema(articles, {
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: z.string().min(1, '内容不能为空'),
  pathname: pathnameSchema.optional(),
  author: z.string().min(1, '作者不能为空'),
  tags: z.array(z.string()).nullable().optional(),
});

export const $ArticleUpd = createUpdateSchema(articles, {
  title: z.string().min(1).max(200).optional(),
  pathname: pathnameSchema.optional(),
});

export const Article = $Article;
export const ArticleReq = $ArticleIns.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewer: true,
});
export const ArticlePatch = $ArticleUpd.omit({ id: true, createdAt: true, updatedAt: true });

export const ArticleList = z.object({
  items: z.array(Article),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

// ============================================================
// CATEGORY
// ============================================================

export const $Category = createSelectSchema(categories);

export const $CategoryIns = createInsertSchema(categories, {
  name: z.string().min(1, '分类名称不能为空').max(50, '分类名称最多50个字符'),
  slug: slugSchema.optional(),
});

export const $CategoryUpd = createUpdateSchema(categories, {
  name: z.string().min(1).max(50).optional(),
  slug: slugSchema.optional(),
});

export const Category = $Category.extend({
  count: z.number().optional(),
});

export const CategoryReq = $CategoryIns.omit({ id: true, createdAt: true, updatedAt: true });
export const CategoryPatch = $CategoryUpd.omit({ id: true, createdAt: true, updatedAt: true });

// ============================================================
// TAG
// ============================================================

export const $Tag = createSelectSchema(tags);

export const $TagIns = createInsertSchema(tags, {
  name: z.string().min(1, '标签名称不能为空').max(30, '标签名称最多30个字符'),
  slug: slugSchema.optional(),
});

export const $TagUpd = createUpdateSchema(tags, {
  name: z.string().min(1).max(30).optional(),
  slug: slugSchema.optional(),
});

export const Tag = $Tag.extend({
  count: z.number().optional(),
});

export const TagReq = $TagIns.omit({ id: true, createdAt: true });
export const TagPatch = $TagUpd.omit({ id: true, createdAt: true });

// ============================================================
// DRAFT
// ============================================================

export const $Draft = createSelectSchema(drafts);

export const $DraftIns = createInsertSchema(drafts, {
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: z.string().min(1, '内容不能为空'),
  pathname: pathnameSchema.optional(),
  author: z.string().min(1, '作者不能为空'),
  tags: z.array(z.string()).nullable().optional(),
});

export const $DraftUpd = createUpdateSchema(drafts, {
  title: z.string().min(1).max(200).optional(),
  pathname: pathnameSchema.optional(),
});

export const Draft = $Draft;
export const DraftReq = $DraftIns.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
});
export const DraftPatch = $DraftUpd.omit({ id: true, createdAt: true, updatedAt: true });

export const DraftList = z.object({
  items: z.array(Draft),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

// ============================================================
// DRAFT VERSION
// ============================================================

export const $DraftVersion = createSelectSchema(draftVersions);

export const $DraftVersionIns = createInsertSchema(draftVersions, {
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: z.string().min(1, '内容不能为空'),
  author: z.string().min(1, '作者不能为空'),
});

export const DraftVersion = $DraftVersion;

// ============================================================
// STATIC FILE
// ============================================================

export const $StaticFile = createSelectSchema(staticFiles);

export const $StaticFileIns = createInsertSchema(staticFiles, {
  filename: z.string().min(1, '文件名不能为空'),
  path: z.string().min(1, '文件路径不能为空'),
  size: z.number().min(0, '文件大小不能为负数'),
  mimeType: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.]*$/, '无效的MIME类型')
    .optional(),
});

export const $StaticFileUpd = createUpdateSchema(staticFiles);

export const StaticFile = $StaticFile;
export const StaticFileReq = $StaticFileIns.omit({ id: true, createdAt: true });

// ============================================================
// SITE META
// ============================================================

export const $SiteMeta = createSelectSchema(siteMeta);

export const $SiteMetaIns = createInsertSchema(siteMeta, {
  key: z.string().min(1, '键名不能为空').max(100, '键名最多100个字符'),
});

export const $SiteMetaUpd = createUpdateSchema(siteMeta, {
  key: z.string().min(1).max(100).optional(),
});

export const SiteMeta = $SiteMeta;
export const SiteMetaReq = $SiteMetaIns.omit({ id: true, createdAt: true, updatedAt: true });
export const SiteMetaPatch = $SiteMetaUpd.omit({ id: true, createdAt: true, updatedAt: true });

// ============================================================
// LOGIN LOG
// ============================================================

export const $LoginLog = createSelectSchema(loginLogs);

export const $LoginLogIns = createInsertSchema(loginLogs, {
  username: z.string().min(1, '用户名不能为空'),
});

export const LoginLog = $LoginLog;

// ============================================================
// CUSTOM PAGE
// ============================================================

export const $CustomPage = createSelectSchema(customPages);

export const $CustomPageIns = createInsertSchema(customPages, {
  title: z.string().min(1, '页面标题不能为空').max(200, '页面标题最多200个字符'),
  pathname: pathnameSchema,
  content: z.string().min(1, '页面内容不能为空'),
});

export const $CustomPageUpd = createUpdateSchema(customPages, {
  title: z.string().min(1).max(200).optional(),
  pathname: pathnameSchema.optional(),
  content: z.string().min(1).optional(),
});

export const CustomPage = $CustomPage;
export const CustomPageReq = $CustomPageIns.omit({ id: true, createdAt: true, updatedAt: true });
export const CustomPagePatch = $CustomPageUpd.omit({ id: true, createdAt: true, updatedAt: true });

// ============================================================
// ANALYTICS
// ============================================================

export const $Analytics = createSelectSchema(analytics);

export const $AnalyticsIns = createInsertSchema(analytics, {
  type: z.string().refine((val) => ['pageview', 'event', 'api_call'].includes(val), '类型无效'),
});

export const Analytics = $Analytics;

// ============================================================
// PERMISSION NODE
// ============================================================

export const $PermissionNode = createSelectSchema(permissionNodes);

export const $PermissionNodeIns = createInsertSchema(permissionNodes, {
  name: z.string().min(1, '权限节点名称不能为空').max(100, '权限节点名称最多100个字符'),
  module: z.string().min(1, '模块名称不能为空').max(50, '模块名称最多50个字符'),
});

export const $PermissionNodeUpd = createUpdateSchema(permissionNodes, {
  name: z.string().min(1).max(100).optional(),
  module: z.string().min(1).max(50).optional(),
});

export const PermissionNode = $PermissionNode;
export const PermissionNodeReq = $PermissionNodeIns.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const PermissionNodePatch = $PermissionNodeUpd.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================
// PERMISSION GROUP
// ============================================================

export const $PermissionGroup = createSelectSchema(permissionGroups);

export const $PermissionGroupIns = createInsertSchema(permissionGroups, {
  name: z.string().min(1, '权限组名称不能为空').max(100, '权限组名称最多100个字符'),
});

export const $PermissionGroupUpd = createUpdateSchema(permissionGroups, {
  name: z.string().min(1).max(100).optional(),
});

export const PermissionGroup = $PermissionGroup;
export const PermissionGroupReq = $PermissionGroupIns.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const PermissionGroupPatch = $PermissionGroupUpd.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================
// PLUGIN DATA
// ============================================================

export const $PluginData = createSelectSchema(pluginData);

export const $PluginDataIns = createInsertSchema(pluginData, {
  pluginId: z.string().min(1, '插件ID不能为空'),
  key: z.string().min(1, '键名不能为空'),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const $PluginDataUpd = createUpdateSchema(pluginData, {
  pluginId: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const PluginData = $PluginData;
export const PluginDataReq = $PluginDataIns;
export const PluginDataPatch = $PluginDataUpd;

// ============================================================
// WEBHOOK
// ============================================================

export const $Webhook = createSelectSchema(webhooks);

export const $WebhookIns = createInsertSchema(webhooks, {
  name: z.string().min(1, 'Webhook名称不能为空').max(100, 'Webhook名称最多100个字符'),
  url: z.string().min(1, 'Webhook URL不能为空'),
  events: z.array(z.string()).min(1, '至少需要选择一个事件'),
}).omit({
  id: true,
  lastTriggered: true,
  lastStatus: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
});

export const $WebhookUpd = createUpdateSchema(webhooks, {
  name: z.string().min(1).max(100).optional(),
  url: z.string().min(1).optional(),
  events: z.array(z.string()).min(1).optional(),
}).omit({
  id: true,
  lastTriggered: true,
  lastStatus: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
});

export const Webhook = $Webhook;
export const WebhookReq = $WebhookIns;
export const WebhookPatch = $WebhookUpd;

// ============================================================
// WEBHOOK LOG
// ============================================================

export const $WebhookLog = createSelectSchema(webhookLogs);

export const $WebhookLogIns = createInsertSchema(webhookLogs, {
  event: z.string().min(1, '事件名称不能为空'),
  status: z.enum(['success', 'failed', 'timeout'], { message: '状态无效' }),
}).omit({ id: true, createdAt: true });

export const WebhookLog = $WebhookLog;

// ============================================================
// TYPE EXPORTS
// ============================================================

// DB Types
export type $User = z.infer<typeof $User>;
export type $UserIns = z.infer<typeof $UserIns>;
export type $UserUpd = z.infer<typeof $UserUpd>;

export type $Article = z.infer<typeof $Article>;
export type $ArticleIns = z.infer<typeof $ArticleIns>;
export type $ArticleUpd = z.infer<typeof $ArticleUpd>;

export type $Category = z.infer<typeof $Category>;
export type $CategoryIns = z.infer<typeof $CategoryIns>;
export type $CategoryUpd = z.infer<typeof $CategoryUpd>;

export type $Tag = z.infer<typeof $Tag>;
export type $TagIns = z.infer<typeof $TagIns>;
export type $TagUpd = z.infer<typeof $TagUpd>;

export type $Draft = z.infer<typeof $Draft>;
export type $DraftIns = z.infer<typeof $DraftIns>;
export type $DraftUpd = z.infer<typeof $DraftUpd>;

export type $DraftVersion = z.infer<typeof $DraftVersion>;
export type $DraftVersionIns = z.infer<typeof $DraftVersionIns>;

export type $StaticFile = z.infer<typeof $StaticFile>;
export type $StaticFileIns = z.infer<typeof $StaticFileIns>;

export type $SiteMeta = z.infer<typeof $SiteMeta>;
export type $SiteMetaIns = z.infer<typeof $SiteMetaIns>;
export type $SiteMetaUpd = z.infer<typeof $SiteMetaUpd>;

export type $LoginLog = z.infer<typeof $LoginLog>;
export type $LoginLogIns = z.infer<typeof $LoginLogIns>;

export type $CustomPage = z.infer<typeof $CustomPage>;
export type $CustomPageIns = z.infer<typeof $CustomPageIns>;
export type $CustomPageUpd = z.infer<typeof $CustomPageUpd>;

export type $Analytics = z.infer<typeof $Analytics>;
export type $AnalyticsIns = z.infer<typeof $AnalyticsIns>;

export type $PermissionNode = z.infer<typeof $PermissionNode>;
export type $PermissionNodeIns = z.infer<typeof $PermissionNodeIns>;
export type $PermissionNodeUpd = z.infer<typeof $PermissionNodeUpd>;

export type $PermissionGroup = z.infer<typeof $PermissionGroup>;
export type $PermissionGroupIns = z.infer<typeof $PermissionGroupIns>;
export type $PermissionGroupUpd = z.infer<typeof $PermissionGroupUpd>;

export type $PluginData = z.infer<typeof $PluginData>;
export type $PluginDataIns = z.infer<typeof $PluginDataIns>;
export type $PluginDataUpd = z.infer<typeof $PluginDataUpd>;

export type $Webhook = z.infer<typeof $Webhook>;
export type $WebhookIns = z.infer<typeof $WebhookIns>;
export type $WebhookUpd = z.infer<typeof $WebhookUpd>;

export type $WebhookLog = z.infer<typeof $WebhookLog>;
export type $WebhookLogIns = z.infer<typeof $WebhookLogIns>;

// API Types
export type User = z.infer<typeof User>;
export type UserReq = z.infer<typeof UserReq>;
export type UserPatch = z.infer<typeof UserPatch>;

export type Article = z.infer<typeof Article>;
export type ArticleReq = z.infer<typeof ArticleReq>;
export type ArticlePatch = z.infer<typeof ArticlePatch>;
export type ArticleList = z.infer<typeof ArticleList>;

export type Category = z.infer<typeof Category>;
export type CategoryReq = z.infer<typeof CategoryReq>;
export type CategoryPatch = z.infer<typeof CategoryPatch>;

export type Tag = z.infer<typeof Tag>;
export type TagReq = z.infer<typeof TagReq>;
export type TagPatch = z.infer<typeof TagPatch>;

export type Draft = z.infer<typeof Draft>;
export type DraftReq = z.infer<typeof DraftReq>;
export type DraftPatch = z.infer<typeof DraftPatch>;
export type DraftList = z.infer<typeof DraftList>;

export type DraftVersion = z.infer<typeof DraftVersion>;

export type StaticFile = z.infer<typeof StaticFile>;
export type StaticFileReq = z.infer<typeof StaticFileReq>;

export type SiteMeta = z.infer<typeof SiteMeta>;
export type SiteMetaReq = z.infer<typeof SiteMetaReq>;
export type SiteMetaPatch = z.infer<typeof SiteMetaPatch>;

export type LoginLog = z.infer<typeof LoginLog>;

export type CustomPage = z.infer<typeof CustomPage>;
export type CustomPageReq = z.infer<typeof CustomPageReq>;
export type CustomPagePatch = z.infer<typeof CustomPagePatch>;

export type Analytics = z.infer<typeof Analytics>;

export type PermissionNode = z.infer<typeof PermissionNode>;
export type PermissionNodeReq = z.infer<typeof PermissionNodeReq>;
export type PermissionNodePatch = z.infer<typeof PermissionNodePatch>;

export type PermissionGroup = z.infer<typeof PermissionGroup>;
export type PermissionGroupReq = z.infer<typeof PermissionGroupReq>;
export type PermissionGroupPatch = z.infer<typeof PermissionGroupPatch>;

export type PluginData = z.infer<typeof PluginData>;
export type PluginDataReq = z.infer<typeof PluginDataReq>;
export type PluginDataPatch = z.infer<typeof PluginDataPatch>;

export type Webhook = z.infer<typeof Webhook>;
export type WebhookReq = z.infer<typeof WebhookReq>;
export type WebhookPatch = z.infer<typeof WebhookPatch>;

export type WebhookLog = z.infer<typeof WebhookLog>;

// ============================================================
// COMMON API SCHEMAS
// 通用 API Schemas（跨实体使用）
// ============================================================

/**
 * 分页查询参数
 *
 * Pagination query parameters for list endpoints.
 */
export const PaginationQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * 搜索查询参数（继承分页参数）
 *
 * Search query parameters - extends pagination with keyword search.
 */
export const SearchQuery = PaginationQuery.extend({
  keyword: z.string().optional(),
});

/**
 * 文章查询参数（继承分页参数，添加文章特定筛选）
 *
 * Article-specific query parameters - extends pagination with article filters.
 */
export const ArticleQuery = PaginationQuery.extend({
  category: z.string().optional(),
  tag: z.string().optional(),
  author: z.string().optional(),
  hidden: z.coerce.boolean().optional(),
  private: z.coerce.boolean().optional(),
});

/**
 * 通用成功响应
 *
 * Generic success response.
 */
export const SuccessResponse = z.object({
  success: z.literal(true),
});

/**
 * 通用删除响应
 *
 * Generic delete response.
 */
export const DeleteResponse = z.object({
  success: z.boolean(),
});

/**
 * 密码验证请求
 *
 * Password verification request schema.
 */
export const PasswordVerifyReq = z.object({
  password: z.string().min(1),
});

/**
 * 密码验证响应
 *
 * Password verification response schema.
 */
export const PasswordVerifyResp = z.object({
  valid: z.boolean(),
  content: z.string().optional(),
});

// 类型导出
export type PaginationQuery = z.infer<typeof PaginationQuery>;
export type SearchQuery = z.infer<typeof SearchQuery>;
export type ArticleQuery = z.infer<typeof ArticleQuery>;
export type SuccessResponse = z.infer<typeof SuccessResponse>;
export type DeleteResponse = z.infer<typeof DeleteResponse>;
export type PasswordVerifyReq = z.infer<typeof PasswordVerifyReq>;
export type PasswordVerifyResp = z.infer<typeof PasswordVerifyResp>;
