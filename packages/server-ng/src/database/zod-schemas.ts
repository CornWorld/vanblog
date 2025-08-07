import { createSelectSchema, createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

import { safeParseJson, dataSchemas } from '../shared/zod';

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
  pipelines,
  analytics,
  permissionNodes,
  permissionGroups,
  codeSnippets,
} from './schema';

// User schemas
export const selectUserSchema = createSelectSchema(users, {
  permissions: (schema) =>
    schema.transform((str) => {
      if (!str) {
        return [];
      }
      try {
        return JSON.parse(str) as string[];
      } catch {
        return [];
      }
    }),
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
  updatedAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertUserSchema = createInsertSchema(users, {
  username: (schema) => schema.min(3, '用户名至少3个字符').max(20, '用户名最多20个字符'),
  password: (schema) => schema.min(6, '密码至少6个字符'),
  email: () => z.string().pipe(z.email('请输入有效的邮箱地址')).optional(),
  permissions: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    }),
});

export const updateUserSchema = createUpdateSchema(users, {
  username: (schema) => schema.min(3, '用户名至少3个字符').max(20, '用户名最多20个字符').optional(),
  password: (schema) => schema.min(6, '密码至少6个字符').optional(),
  email: () => z.string().pipe(z.email('请输入有效的邮箱地址')).optional(),
  permissions: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    })
    .optional(),
});

// Article schemas
export const selectArticleSchema = createSelectSchema(articles, {
  tags: (schema) =>
    schema.transform((str) => {
      if (!str) {
        return [];
      }
      try {
        return JSON.parse(str) as string[];
      } catch {
        return [];
      }
    }),
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
  updatedAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertArticleSchema = createInsertSchema(articles, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: (schema) => schema.min(1, '内容不能为空'),
  pathname: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线').optional(),
  tags: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    }),
  author: (schema) => schema.min(1, '作者不能为空'),
});

export const updateArticleSchema = createUpdateSchema(articles, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符').optional(),
  pathname: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线').optional(),
  tags: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    }),
});

// Category schemas
export const selectCategorySchema = createSelectSchema(categories, {
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
});

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

// Tag schemas
export const selectTagSchema = createSelectSchema(tags, {
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
});

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

// Draft schemas
export const selectDraftSchema = createSelectSchema(drafts, {
  tags: (schema) =>
    schema.transform((str) => {
      if (!str) {
        return [];
      }
      try {
        return JSON.parse(str) as string[];
      } catch {
        return [];
      }
    }),
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
  updatedAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertDraftSchema = createInsertSchema(drafts, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: (schema) => schema.min(1, '内容不能为空'),
  pathname: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线').optional(),
  tags: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    }),
  author: (schema) => schema.min(1, '作者不能为空'),
});

export const updateDraftSchema = createUpdateSchema(drafts, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符').optional(),
  pathname: (schema) =>
    schema.regex(/^[a-zA-Z0-9-_/]+$/, '路径只能包含字母、数字、连字符和下划线').optional(),
  tags: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    }),
});

// Draft Version schemas
export const selectDraftVersionSchema = createSelectSchema(draftVersions, {
  tags: (schema) =>
    schema.transform((str) => {
      if (!str) {
        return [];
      }
      try {
        return JSON.parse(str) as string[];
      } catch {
        return [];
      }
    }),
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertDraftVersionSchema = createInsertSchema(draftVersions, {
  title: (schema) => schema.min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: (schema) => schema.min(1, '内容不能为空'),
  tags: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    }),
  author: (schema) => schema.min(1, '作者不能为空'),
});

// Static Files schemas
export const selectStaticFileSchema = createSelectSchema(staticFiles, {
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
});

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

// Site Meta schemas
export const selectSiteMetaSchema = createSelectSchema(siteMeta, {
  value: (schema) =>
    schema.transform((str): unknown => {
      return safeParseJson(str, dataSchemas.genericObject) ?? str;
    }),
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
  updatedAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertSiteMetaSchema = createInsertSchema(siteMeta, {
  key: (schema) => schema.min(1, '键名不能为空').max(100, '键名最多100个字符'),
  value: z
    .any()
    .optional()
    .transform((val) => {
      return val !== undefined ? JSON.stringify(val) : null;
    }),
});

export const updateSiteMetaSchema = createUpdateSchema(siteMeta, {
  key: (schema) => schema.min(1, '键名不能为空').max(100, '键名最多100个字符').optional(),
  value: z
    .any()
    .optional()
    .transform((val) => {
      return val !== undefined ? JSON.stringify(val) : null;
    }),
});

// Login Logs schemas
export const selectLoginLogSchema = createSelectSchema(loginLogs, {
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertLoginLogSchema = createInsertSchema(loginLogs, {
  username: (schema) => schema.min(1, '用户名不能为空'),
});

// Custom Pages schemas
export const selectCustomPageSchema = createSelectSchema(customPages, {
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
  updatedAt: (schema) => schema.transform((date) => date.toISOString()),
});

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

// Pipeline schemas
export const selectPipelineSchema = createSelectSchema(pipelines, {
  deps: (schema) =>
    schema.transform((str) => {
      if (!str) {
        return [];
      }
      try {
        return JSON.parse(str) as string[];
      } catch {
        return [];
      }
    }),
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
  updatedAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertPipelineSchema = createInsertSchema(pipelines, {
  name: (schema) => schema.min(1, 'Pipeline名称不能为空').max(100, 'Pipeline名称最多100个字符'),
  eventName: (schema) => schema.min(1, '事件名称不能为空'),
  script: (schema) => schema.min(1, '脚本内容不能为空'),
  deps: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    }),
});

export const updatePipelineSchema = createUpdateSchema(pipelines, {
  name: (schema) =>
    schema.min(1, 'Pipeline名称不能为空').max(100, 'Pipeline名称最多100个字符').optional(),
  eventName: (schema) => schema.min(1, '事件名称不能为空').optional(),
  script: (schema) => schema.min(1, '脚本内容不能为空').optional(),
  deps: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    }),
});

// Analytics schemas
export const selectAnalyticsSchema = createSelectSchema(analytics, {
  data: (schema) =>
    schema.transform((str): unknown => {
      if (!str) {
        return null;
      }
      try {
        const parseResult = z.unknown().safeParse(str);
        if (!parseResult.success) {
          return null;
        }
        return JSON.parse(str);
      } catch {
        return null;
      }
    }),
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertAnalyticsSchema = createInsertSchema(analytics, {
  type: z.enum(['pageview', 'event', 'api_call'], {
    message: '分析类型必须是 pageview、event 或 api_call',
  }),
  userAgent: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  data: z
    .any()
    .optional()
    .transform((val): string | null => {
      return val !== undefined ? JSON.stringify(val) : null;
    }),
});

// Type exports for TypeScript inference
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

export type SelectPipeline = z.infer<typeof selectPipelineSchema>;
export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
export type UpdatePipeline = z.infer<typeof updatePipelineSchema>;

export type SelectAnalytics = z.infer<typeof selectAnalyticsSchema>;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;

// Permission Node schemas
export const selectPermissionNodeSchema = createSelectSchema(permissionNodes, {
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
  updatedAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertPermissionNodeSchema = createInsertSchema(permissionNodes, {
  name: (schema) => schema.min(1, '权限节点名称不能为空').max(100, '权限节点名称最多100个字符'),
  module: (schema) => schema.min(1, '模块名称不能为空').max(50, '模块名称最多50个字符'),
});

export const updatePermissionNodeSchema = createUpdateSchema(permissionNodes, {
  name: (schema) =>
    schema.min(1, '权限节点名称不能为空').max(100, '权限节点名称最多100个字符').optional(),
  module: (schema) => schema.min(1, '模块名称不能为空').max(50, '模块名称最多50个字符').optional(),
});

// Permission Group schemas
export const selectPermissionGroupSchema = createSelectSchema(permissionGroups, {
  permissions: (schema) =>
    schema.transform((str) => {
      if (!str) {
        return [];
      }
      try {
        return JSON.parse(str) as string[];
      } catch {
        return [];
      }
    }),
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
  updatedAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertPermissionGroupSchema = createInsertSchema(permissionGroups, {
  name: (schema) => schema.min(1, '权限组名称不能为空').max(100, '权限组名称最多100个字符'),
  permissions: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    }),
});

export const updatePermissionGroupSchema = createUpdateSchema(permissionGroups, {
  name: (schema) =>
    schema.min(1, '权限组名称不能为空').max(100, '权限组名称最多100个字符').optional(),
  permissions: z
    .array(z.string())
    .optional()
    .transform((arr) => {
      return arr ? JSON.stringify(arr) : null;
    }),
});

// Code snippet schemas
export const selectCodeSnippetSchema = createSelectSchema(codeSnippets, {
  createdAt: (schema) => schema.transform((date) => date.toISOString()),
  updatedAt: (schema) => schema.transform((date) => date.toISOString()),
});

export const insertCodeSnippetSchema = createInsertSchema(codeSnippets, {
  name: (schema) => schema.min(1, '代码片段名称不能为空').max(255, '代码片段名称最多255个字符'),
  hookName: (schema) => schema.min(1, 'Hook名称不能为空').max(255, 'Hook名称最多255个字符'),
  code: (schema) => schema.min(1, '代码内容不能为空'),
  priority: (schema) => schema.min(1, '优先级最小为1').max(100, '优先级最大为100'),
  timeout: (schema) => schema.min(100, '超时时间最小为100ms').max(60000, '超时时间最大为60秒'),
});

export const updateCodeSnippetSchema = createUpdateSchema(codeSnippets, {
  name: (schema) =>
    schema.min(1, '代码片段名称不能为空').max(255, '代码片段名称最多255个字符').optional(),
  hookName: (schema) =>
    schema.min(1, 'Hook名称不能为空').max(255, 'Hook名称最多255个字符').optional(),
  code: (schema) => schema.min(1, '代码内容不能为空').optional(),
  priority: (schema) => schema.min(1, '优先级最小为1').max(100, '优先级最大为100').optional(),
  timeout: (schema) =>
    schema.min(100, '超时时间最小为100ms').max(60000, '超时时间最大为60秒').optional(),
});

export type SelectPermissionNode = z.infer<typeof selectPermissionNodeSchema>;
export type InsertPermissionNode = z.infer<typeof insertPermissionNodeSchema>;
export type UpdatePermissionNode = z.infer<typeof updatePermissionNodeSchema>;

export type SelectPermissionGroup = z.infer<typeof selectPermissionGroupSchema>;
export type InsertPermissionGroup = z.infer<typeof insertPermissionGroupSchema>;
export type UpdatePermissionGroup = z.infer<typeof updatePermissionGroupSchema>;

export type SelectCodeSnippet = z.infer<typeof selectCodeSnippetSchema>;
export type InsertCodeSnippet = z.infer<typeof insertCodeSnippetSchema>;
export type UpdateCodeSnippet = z.infer<typeof updateCodeSnippetSchema>;
