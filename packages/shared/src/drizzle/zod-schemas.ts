/**
 * @file drizzle/zod-schemas.ts
 *
 * Zod schemas generated from Drizzle tables.
 * With mode: 'json' in schema.ts, Drizzle handles JSON serialization automatically.
 * No transforms needed - Drizzle reads/writes JSON natively.
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
  imageProcessingQueue,
  tokenBlacklist,
  pipelines,
} from './schema.js';

// ============================================================
// Password validation schema (reusable)
// ============================================================
const passwordSchema = z
  .string()
  .min(8, '密码至少8个字符')
  .max(128, '密码最多128个字符')
  .regex(/[a-z]/, '密码必须包含至少一个小写字母')
  .regex(/[A-Z]/, '密码必须包含至少一个大写字母')
  .regex(/[0-9]/, '密码必须包含至少一个数字')
  .regex(/[^a-zA-Z0-9]/, '密码必须包含至少一个特殊字符');

// ============================================================
// User schemas
// ============================================================
export const selectUserSchema = createSelectSchema(users).extend({
  permissions: z.array(z.string()).nullable(),
});

export const insertUserSchema = createInsertSchema(users, {
  username: (schema) => schema.min(3, '用户名至少3个字符').max(20, '用户名最多20个字符'),
  password: passwordSchema,
  email: (schema) => schema.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u, '请输入有效的邮箱地址').optional(),
}).extend({
  permissions: z.array(z.string()).nullable().optional(),
});

export const updateUserSchema = createUpdateSchema(users, {
  username: (schema) => schema.min(3, '用户名至少3个字符').max(20, '用户名最多20个字符').optional(),
  password: passwordSchema.optional(),
  email: (schema) => schema.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u, '请输入有效的邮箱地址').optional(),
}).extend({
  permissions: z.array(z.string()).nullable().optional(),
});

// ============================================================
// Article schemas
// ============================================================
export const selectArticleSchema = createSelectSchema(articles).extend({
  tags: z.array(z.string()).nullable(),
});

export const insertArticleSchema = createInsertSchema(articles, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: (schema) => schema.min(1, '内容不能为空'),
  pathname: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线').optional(),
  author: (schema) => schema.min(1, '作者不能为空'),
}).extend({
  tags: z.array(z.string()).nullable(),
});

export const updateArticleSchema = createUpdateSchema(articles, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符').optional(),
  pathname: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线').optional(),
}).extend({
  tags: z.array(z.string()).nullable().optional(),
});

// ============================================================
// Category schemas
// ============================================================
export const selectCategorySchema = createSelectSchema(categories);

export const insertCategorySchema = createInsertSchema(categories, {
  name: (schema) => schema.min(1, '分类名称不能为空').max(50, '分类名称最多50个字符'),
  slug: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_]+$/, 'slug只能包含字母、数字、连字符和下划线').optional(),
});

export const updateCategorySchema = createUpdateSchema(categories, {
  name: (schema) => schema.min(1, '分类名称不能为空').max(50, '分类名称最多50个字符').optional(),
  slug: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_]+$/, 'slug只能包含字母、数字、连字符和下划线').optional(),
});

// ============================================================
// Tag schemas
// ============================================================
export const selectTagSchema = createSelectSchema(tags);

export const insertTagSchema = createInsertSchema(tags, {
  name: (schema) => schema.min(1, '标签名称不能为空').max(30, '标签名称最多30个字符'),
  slug: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_]+$/, 'slug只能包含字母、数字、连字符和下划线').optional(),
});

export const updateTagSchema = createUpdateSchema(tags, {
  name: (schema) => schema.min(1, '标签名称不能为空').max(30, '标签名称最多30个字符').optional(),
  slug: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_]+$/, 'slug只能包含字母、数字、连字符和下划线').optional(),
});

// ============================================================
// Draft schemas
// ============================================================
export const selectDraftSchema = createSelectSchema(drafts).extend({
  tags: z.array(z.string()).nullable(),
});

export const insertDraftSchema = createInsertSchema(drafts, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: (schema) => schema.min(1, '内容不能为空'),
  pathname: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线').optional(),
  author: (schema) => schema.min(1, '作者不能为空'),
}).extend({
  tags: z.array(z.string()).nullable(),
});

export const updateDraftSchema = createUpdateSchema(drafts, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符').optional(),
  pathname: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线').optional(),
}).extend({
  tags: z.array(z.string()).nullable().optional(),
});

// ============================================================
// Draft Version schemas
// ============================================================
export const selectDraftVersionSchema = createSelectSchema(draftVersions).extend({
  tags: z.array(z.string()).nullable(),
});

export const insertDraftVersionSchema = createInsertSchema(draftVersions, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: (schema) => schema.min(1, '内容不能为空'),
  author: (schema) => schema.min(1, '作者不能为空'),
}).extend({
  tags: z.array(z.string()).nullable(),
});

export const updateDraftVersionSchema = createUpdateSchema(draftVersions, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符').optional(),
  content: (schema) => schema.min(1, '内容不能为空').optional(),
  author: (schema) => schema.min(1, '作者不能为空').optional(),
}).extend({
  tags: z.array(z.string()).nullable().optional(),
});

// ============================================================
// Static Files schemas
// ============================================================
export const selectStaticFileSchema = createSelectSchema(staticFiles);

export const insertStaticFileSchema = createInsertSchema(staticFiles, {
  filename: (schema) => schema.min(1, '文件名不能为空'),
  path: (schema) => schema.min(1, '文件路径不能为空'),
  size: (schema) => schema.min(0, '文件大小不能为负数'),
  mimeType: (schema) =>
    schema
      .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.]*$/,
        '无效的MIME类型',
      )
      .optional(),
});

export const updateStaticFileSchema = createUpdateSchema(staticFiles);

// ============================================================
// Site Meta schemas
// ============================================================
export const selectSiteMetaSchema = createSelectSchema(siteMeta);

export const insertSiteMetaSchema = createInsertSchema(siteMeta, {
  key: (schema) => schema.min(1, '键名不能为空').max(100, '键名最多100个字符'),
});

export const updateSiteMetaSchema = createUpdateSchema(siteMeta, {
  key: (schema) => schema.min(1, '键名不能为空').max(100, '键名最多100个字符').optional(),
});

// ============================================================
// Login Logs schemas
// ============================================================
export const selectLoginLogSchema = createSelectSchema(loginLogs);

export const insertLoginLogSchema = createInsertSchema(loginLogs, {
  username: (schema) => schema.min(1, '用户名不能为空'),
});

// ============================================================
// Custom Pages schemas
// ============================================================
export const selectCustomPageSchema = createSelectSchema(customPages);

export const insertCustomPageSchema = createInsertSchema(customPages, {
  title: (schema) => schema.min(1, '页面标题不能为空').max(200, '页面标题最多200个字符'),
  pathname: (schema) => schema.regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线'),
  content: (schema) => schema.min(1, '页面内容不能为空'),
});

export const updateCustomPageSchema = createUpdateSchema(customPages, {
  title: (schema) => schema.min(1, '页面标题不能为空').max(200, '页面标题最多200个字符').optional(),
  pathname: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线').optional(),
  content: (schema) => schema.min(1, '页面内容不能为空').optional(),
});

// ============================================================
// Analytics schemas
// ============================================================
export const selectAnalyticsSchema = createSelectSchema(analytics);

export const insertAnalyticsSchema = createInsertSchema(analytics, {
  type: (schema) =>
    schema.refine(
      (val) => ['pageview', 'event', 'api_call'].includes(val),
      '分析类型必须是 pageview、event 或 api_call',
    ),
  userAgent: (schema) => schema.nullable().optional(),
  ip: (schema) => schema.nullable().optional(),
});

// ============================================================
// Permission Node schemas
// ============================================================
export const selectPermissionNodeSchema = createSelectSchema(permissionNodes);

export const insertPermissionNodeSchema = createInsertSchema(permissionNodes, {
  name: (schema) => schema.min(1, '权限节点名称不能为空').max(100, '权限节点名称最多100个字符'),
  module: (schema) => schema.min(1, '模块名称不能为空').max(50, '模块名称最多50个字符'),
});

export const updatePermissionNodeSchema = createUpdateSchema(permissionNodes, {
  name: (schema) =>
    schema.min(1, '权限节点名称不能为空').max(100, '权限节点名称最多100个字符').optional(),
  module: (schema) => schema.min(1, '模块名称不能为空').max(50, '模块名称最多50个字符').optional(),
});

// ============================================================
// Permission Group schemas
// ============================================================
export const selectPermissionGroupSchema = createSelectSchema(permissionGroups).extend({
  permissions: z.array(z.string()).nullable(),
});

export const insertPermissionGroupSchema = createInsertSchema(permissionGroups, {
  name: (schema) => schema.min(1, '权限组名称不能为空').max(100, '权限组名称最多100个字符'),
  isActive: (schema) => schema.optional().default(true),
}).extend({
  permissions: z.array(z.string()).nullable(),
});

export const updatePermissionGroupSchema = createUpdateSchema(permissionGroups, {
  name: (schema) =>
    schema.min(1, '权限组名称不能为空').max(100, '权限组名称最多100个字符').optional(),
}).extend({
  permissions: z.array(z.string()).nullable().optional(),
});

// ============================================================
// Plugin data schemas
// ============================================================
export const selectPluginDataSchema = createSelectSchema(pluginData);

export const insertPluginDataSchema = createInsertSchema(pluginData, {
  pluginId: (schema) => schema.min(1, '插件ID不能为空'),
  key: (schema) => schema.min(1, '键名不能为空'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePluginDataSchema = createUpdateSchema(pluginData, {
  pluginId: (schema) => schema.min(1, '插件ID不能为空').optional(),
  key: (schema) => schema.min(1, '键名不能为空').optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================
// Webhook schemas
// ============================================================
export const selectWebhookSchema = createSelectSchema(webhooks).extend({
  events: z.array(z.string()),
});

export const insertWebhookSchema = createInsertSchema(webhooks, {
  name: (schema) => schema.min(1, 'Webhook名称不能为空').max(100, 'Webhook名称最多100个字符'),
  url: (schema) => schema.min(1, 'Webhook URL不能为空'),
  events: z.array(z.string()).min(1, '至少需要选择一个事件'),
})
  .omit({
    id: true,
    lastTriggered: true,
    lastStatus: true,
    lastError: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    events: z.array(z.string()),
  });

export const updateWebhookSchema = createUpdateSchema(webhooks, {
  name: (schema) =>
    schema.min(1, 'Webhook名称不能为空').max(100, 'Webhook名称最多100个字符').optional(),
  url: (schema) => schema.min(1, 'Webhook URL不能为空').optional(),
  events: z.array(z.string()).min(1, '至少需要选择一个事件').optional(),
})
  .omit({
    id: true,
    lastTriggered: true,
    lastStatus: true,
    lastError: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    events: z.array(z.string()).optional(),
  });

// ============================================================
// Webhook Log schemas
// ============================================================
export const selectWebhookLogSchema = createSelectSchema(webhookLogs);

export const insertWebhookLogSchema = createInsertSchema(webhookLogs, {
  event: (schema) => schema.min(1, '事件名称不能为空'),
  status: z.enum(['success', 'failed', 'timeout'], {
    message: '状态必须是 success、failed 或 timeout',
  }),
}).omit({
  id: true,
  createdAt: true,
});

// ============================================================
// Plugin metadata schemas
// ============================================================
// pluginMetadata table has been removed from schema.ts

// ============================================================
// Image processing queue schemas
// ============================================================
export const selectImageProcessingQueueSchema = createSelectSchema(imageProcessingQueue);

export const insertImageProcessingQueueSchema = createInsertSchema(imageProcessingQueue, {
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
  priority: z.number().int().default(0),
  maxAttempts: z.number().int().default(3),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateImageProcessingQueueSchema = createUpdateSchema(imageProcessingQueue, {
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  priority: z.number().int().optional(),
  maxAttempts: z.number().int().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================
// Token blacklist schemas
// ============================================================
export const selectTokenBlacklistSchema = createSelectSchema(tokenBlacklist);

export const insertTokenBlacklistSchema = createInsertSchema(tokenBlacklist, {
  tokenHash: (schema) => schema.min(1, '令牌哈希不能为空'),
  tokenType: z.enum(['access', 'refresh']),
  expiresAt: (schema) => schema.min(1, '过期时间不能为空'),
}).omit({
  id: true,
  createdAt: true,
});

// ============================================================
// Pipeline schemas
// ============================================================
export const selectPipelinesSchema = createSelectSchema(pipelines).extend({
  deps: z.array(z.string()),
});

export const insertPipelinesSchema = createInsertSchema(pipelines, {
  name: (schema) => schema.min(1, '管道名称不能为空'),
  eventName: (schema) => schema.min(1, '事件名称不能为空'),
  script: (schema) => schema.min(1, '脚本不能为空'),
  status: z.enum(['idle', 'running', 'success', 'error']).default('idle'),
})
  .omit({
    id: true,
    lastRun: true,
    lastStatus: true,
    lastError: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    deps: z.array(z.string()),
  });

export const updatePipelinesSchema = createUpdateSchema(pipelines, {
  name: (schema) => schema.min(1, '管道名称不能为空').optional(),
  eventName: (schema) => schema.min(1, '事件名称不能为空').optional(),
  script: (schema) => schema.min(1, '脚本不能为空').optional(),
  status: z.enum(['idle', 'running', 'success', 'error']).optional(),
})
  .omit({
    id: true,
    lastRun: true,
    lastStatus: true,
    lastError: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    deps: z.array(z.string()).optional(),
  });

// ============================================================
// Type exports
// ============================================================
export type SelectUser = z.infer<typeof selectUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type SelectArticle = z.infer<typeof selectArticleSchema>;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type UpdateArticle = z.infer<typeof updateArticleSchema>;

export type SelectCategory = z.infer<typeof selectCategorySchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;

export type SelectTag = z.infer<typeof selectTagSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type UpdateTag = z.infer<typeof updateTagSchema>;

export type SelectDraft = z.infer<typeof selectDraftSchema>;
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type UpdateDraft = z.infer<typeof updateDraftSchema>;

export type SelectDraftVersion = z.infer<typeof selectDraftVersionSchema>;
export type InsertDraftVersion = z.infer<typeof insertDraftVersionSchema>;
export type UpdateDraftVersion = z.infer<typeof updateDraftVersionSchema>;

export type SelectStaticFile = z.infer<typeof selectStaticFileSchema>;
export type InsertStaticFile = z.infer<typeof insertStaticFileSchema>;
export type UpdateStaticFile = z.infer<typeof updateStaticFileSchema>;

export type SelectSiteMeta = z.infer<typeof selectSiteMetaSchema>;
export type InsertSiteMeta = z.infer<typeof insertSiteMetaSchema>;
export type UpdateSiteMeta = z.infer<typeof updateSiteMetaSchema>;

export type SelectLoginLog = z.infer<typeof selectLoginLogSchema>;
export type InsertLoginLog = z.infer<typeof insertLoginLogSchema>;

export type SelectCustomPage = z.infer<typeof selectCustomPageSchema>;
export type InsertCustomPage = z.infer<typeof insertCustomPageSchema>;
export type UpdateCustomPage = z.infer<typeof updateCustomPageSchema>;

export type SelectAnalytics = z.infer<typeof selectAnalyticsSchema>;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;

export type SelectPermissionNode = z.infer<typeof selectPermissionNodeSchema>;
export type InsertPermissionNode = z.infer<typeof insertPermissionNodeSchema>;
export type UpdatePermissionNode = z.infer<typeof updatePermissionNodeSchema>;

export type SelectPermissionGroup = z.infer<typeof selectPermissionGroupSchema>;
export type InsertPermissionGroup = z.infer<typeof insertPermissionGroupSchema>;
export type UpdatePermissionGroup = z.infer<typeof updatePermissionGroupSchema>;

export type SelectPluginData = z.infer<typeof selectPluginDataSchema>;
export type InsertPluginData = z.infer<typeof insertPluginDataSchema>;
export type UpdatePluginData = z.infer<typeof updatePluginDataSchema>;

export type SelectWebhook = z.infer<typeof selectWebhookSchema>;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type UpdateWebhook = z.infer<typeof updateWebhookSchema>;
export type SelectWebhookLog = z.infer<typeof selectWebhookLogSchema>;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

export type SelectImageProcessingQueue = z.infer<typeof selectImageProcessingQueueSchema>;
export type InsertImageProcessingQueue = z.infer<typeof insertImageProcessingQueueSchema>;
export type UpdateImageProcessingQueue = z.infer<typeof updateImageProcessingQueueSchema>;

export type SelectTokenBlacklist = z.infer<typeof selectTokenBlacklistSchema>;
export type InsertTokenBlacklist = z.infer<typeof insertTokenBlacklistSchema>;

export type SelectPipelines = z.infer<typeof selectPipelinesSchema>;
export type InsertPipelines = z.infer<typeof insertPipelinesSchema>;
export type UpdatePipelines = z.infer<typeof updatePipelinesSchema>;
