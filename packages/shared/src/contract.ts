import { initContract } from '@ts-rest/core';
import {
  SiteInfoSchema,
  UpdateSiteInfoSchema,
  SiteLayoutSchema,
  UpdateLayoutSchema,
  SiteThemeSchema,
  UpdateThemeSchema,
  FriendLinkSchema,
  CreateFriendLinkSchema,
  UpdateFriendLinkSchema,
  NavigationSchema,
  UpdateNavigationSchema,
  CustomCodeSchema,
  UpdateCustomCodeSchema,
  AboutInfoSchema,
  UpdateAboutSchema,
  SocialItemSchema,
  UpdateSocialSchema,
  SocialTypeEnum,
  SocialTypeInfoSchema,
  WalineSettingSchema,
  UpdateWalineSettingSchema,
  ISRSettingSchema,
  UpdateISRSettingSchema,
  LoginSettingSchema,
  UpdateLoginSettingSchema,
  HttpsSettingSchema,
  UpdateHttpsSettingSchema,
  StaticSettingSchema,
  UpdateStaticSettingSchema,
  RewardItemSchema,
  CreateRewardSchema,
  UpdateRewardSchema,
  CaddyLogSchema,
  CaddyConfigSchema,
  LoginSchema,
  UserSchema,
  UpdateUserSchema,
  CreateCollaboratorSchema,
  UpdateCollaboratorSchema,
  TokenSchema,
  CreateTokenSchema,
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  TagSchema,
  CreateTagSchema,
  UpdateTagSchema,
  ArticleSchema,
  CreateArticleSchema,
  UpdateArticleSchema,
  DraftSchema,
  CreateDraftSchema,
  UpdateDraftSchema,
  MediaSchema,
  CustomPageSchema,
  CreateCustomPageSchema,
  UpdateCustomPageSchema,
  PublicCustomPageSchema,
  CustomPageListSchema,
  PipelineSchema,
  CreatePipelineSchema,
  UpdatePipelineSchema,
  AnalyticsLogSchema,
  VersionInfoSchema,
  InitSchema,
} from './schemas.js';
import { z } from 'zod';

const c = initContract();

export const contract = c.router({
  // Auth
  login: {
    method: 'POST',
    path: '/auth/login',
    body: LoginSchema,
    responses: {
      200: z.object({ token: z.string() }),
    },
    summary: 'Login',
  },
  logout: {
    method: 'POST',
    path: '/auth/logout',
    body: z.object({}),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Logout',
  },
  // User
  updateProfile: {
    method: 'PUT',
    path: '/admin/users/profile',
    body: UpdateUserSchema,
    responses: {
      200: UserSchema,
    },
    summary: 'Update user profile',
  },
  getCollaborators: {
    method: 'GET',
    path: '/admin/users/collaborators',
    responses: {
      200: z.array(UserSchema),
    },
    summary: 'Get all collaborators',
  },
  createCollaborator: {
    method: 'POST',
    path: '/admin/users/collaborators',
    body: CreateCollaboratorSchema,
    responses: {
      201: UserSchema,
    },
    summary: 'Create collaborator',
  },
  updateCollaborator: {
    method: 'PUT',
    path: '/admin/users/collaborators',
    body: UpdateCollaboratorSchema,
    responses: {
      200: UserSchema,
    },
    summary: 'Update collaborator',
  },
  deleteCollaborator: {
    method: 'DELETE',
    path: '/admin/users/collaborators/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Delete collaborator',
  },
  // Token
  getTokens: {
    method: 'GET',
    path: '/admin/tokens',
    responses: {
      200: z.array(TokenSchema),
    },
    summary: 'Get all API tokens',
  },
  createToken: {
    method: 'POST',
    path: '/admin/tokens',
    body: CreateTokenSchema,
    responses: {
      201: TokenSchema,
    },
    summary: 'Create API token',
  },
  deleteToken: {
    method: 'DELETE',
    path: '/admin/tokens/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Delete API token',
  },
  // Category
  getCategories: {
    method: 'GET',
    path: '/admin/categories',
    query: z.object({ detail: z.string().optional() }),
    responses: {
      200: z.array(CategorySchema),
    },
    summary: 'Get all categories',
  },
  createCategory: {
    method: 'POST',
    path: '/admin/categories',
    body: CreateCategorySchema,
    responses: {
      201: CategorySchema,
    },
    summary: 'Create category',
  },
  updateCategory: {
    method: 'PUT',
    path: '/admin/categories/:name',
    pathParams: z.object({ name: z.string() }),
    body: UpdateCategorySchema,
    responses: {
      200: CategorySchema,
    },
    summary: 'Update category',
  },
  deleteCategory: {
    method: 'DELETE',
    path: '/admin/categories/:name',
    pathParams: z.object({ name: z.string() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Delete category',
  },
  getArticlesByCategory: {
    method: 'GET',
    path: '/admin/categories/:name/articles',
    pathParams: z.object({ name: z.string() }),
    responses: {
      200: z.array(ArticleSchema),
    },
    summary: 'Get articles by category',
  },
  // Tag
  getTags: {
    method: 'GET',
    path: '/admin/tags',
    responses: {
      200: z.array(TagSchema),
    },
    summary: 'Get all tags',
  },
  createTag: {
    method: 'POST',
    path: '/admin/tags',
    body: CreateTagSchema,
    responses: {
      201: TagSchema,
    },
    summary: 'Create tag',
  },
  updateTag: {
    method: 'PUT',
    path: '/admin/tags/:name',
    pathParams: z.object({ name: z.string() }),
    body: UpdateTagSchema,
    responses: {
      200: TagSchema,
    },
    summary: 'Update tag',
  },
  deleteTag: {
    method: 'DELETE',
    path: '/admin/tags/:name',
    pathParams: z.object({ name: z.string() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Delete tag',
  },
  // Article (Admin)
  getAdminArticles: {
    method: 'GET',
    path: '/admin/articles',
    query: z.object({
      page: z.coerce.number().optional(),
      pageSize: z.coerce.number().optional(),
      category: z.string().optional(),
      tag: z.string().optional(),
      topping: z
        .string()
        .transform((v) => v === 'true')
        .optional(),
      hidden: z
        .string()
        .transform((v) => v === 'true')
        .optional(),
      password: z
        .string()
        .transform((v) => v === 'true')
        .optional(),
    }),
    responses: {
      200: z.object({
        items: z.array(ArticleSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
      }),
    },
    summary: 'Get articles (admin)',
  },
  createArticle: {
    method: 'POST',
    path: '/admin/articles',
    body: CreateArticleSchema,
    responses: {
      201: ArticleSchema,
    },
    summary: 'Create article',
  },
  updateArticle: {
    method: 'PUT',
    path: '/admin/articles/:id',
    pathParams: z.object({ id: z.string() }),
    body: UpdateArticleSchema,
    responses: {
      200: ArticleSchema,
    },
    summary: 'Update article',
  },
  deleteArticle: {
    method: 'DELETE',
    path: '/admin/articles/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Delete article',
  },
  getAdminArticle: {
    method: 'GET',
    path: '/admin/articles/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: ArticleSchema,
    },
    summary: 'Get article (admin)',
  },
  searchAdminArticles: {
    method: 'GET',
    path: '/admin/articles/search',
    query: z.object({
      keyword: z.string(),
      page: z.coerce.number().optional(),
      pageSize: z.coerce.number().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      includeHidden: z
        .string()
        .transform((v) => v === 'true')
        .optional(),
      titleOnly: z
        .string()
        .transform((v) => v === 'true')
        .optional(),
      contentOnly: z
        .string()
        .transform((v) => v === 'true')
        .optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['ASC', 'DESC']).optional(),
    }),
    responses: {
      200: z.object({
        items: z.array(ArticleSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
      }),
    },
    summary: 'Search articles (admin)',
  },
  // Draft
  getDrafts: {
    method: 'GET',
    path: '/admin/drafts',
    query: z.object({
      page: z.coerce.number().optional(),
      pageSize: z.coerce.number().optional(),
      category: z.string().optional(),
      tag: z.string().optional(),
    }),
    responses: {
      200: z.object({
        items: z.array(DraftSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
      }),
    },
    summary: 'Get drafts',
  },
  createDraft: {
    method: 'POST',
    path: '/admin/drafts',
    body: CreateDraftSchema,
    responses: {
      201: DraftSchema,
    },
    summary: 'Create draft',
  },
  updateDraft: {
    method: 'PUT',
    path: '/admin/drafts/:id',
    pathParams: z.object({ id: z.string() }),
    body: UpdateDraftSchema,
    responses: {
      200: DraftSchema,
    },
    summary: 'Update draft',
  },
  deleteDraft: {
    method: 'DELETE',
    path: '/admin/drafts/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Delete draft',
  },
  getDraft: {
    method: 'GET',
    path: '/admin/drafts/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: DraftSchema,
    },
    summary: 'Get draft',
  },
  publishDraft: {
    method: 'POST',
    path: '/admin/drafts/:id/publish',
    pathParams: z.object({ id: z.string() }),
    body: z.object({}),
    responses: {
      200: ArticleSchema,
    },
    summary: 'Publish draft',
  },
  // Media
  getMedia: {
    method: 'GET',
    path: '/admin/media',
    query: z.object({
      page: z.coerce.number().optional(),
      pageSize: z.coerce.number().optional(),
    }),
    responses: {
      200: z.object({
        items: z.array(MediaSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
      }),
    },
    summary: 'Get media files',
  },
  deleteMedia: {
    method: 'DELETE',
    path: '/admin/media/:sign',
    pathParams: z.object({ sign: z.string() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Delete media file',
  },
  batchDeleteMedia: {
    method: 'POST',
    path: '/admin/media/batch-delete',
    body: z.object({}),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Batch delete media files',
  },
  scanMedia: {
    method: 'POST',
    path: '/admin/media/scan-articles',
    body: z.object({}),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Scan articles for media',
  },
  exportMedia: {
    method: 'GET',
    path: '/admin/media/export/all',
    responses: {
      200: z.any(), // Blob/File
    },
    summary: 'Export all media',
  },
  // Custom Page (Admin)
  getCustomPages: {
    method: 'GET',
    path: '/admin/custom-pages/all',
    responses: {
      200: z.array(CustomPageSchema),
    },
    summary: 'Get all custom pages',
  },
  getCustomPage: {
    method: 'GET',
    path: '/admin/custom-pages',
    query: z.object({ path: z.string() }),
    responses: {
      200: CustomPageSchema,
    },
    summary: 'Get custom page',
  },
  createCustomPage: {
    method: 'POST',
    path: '/admin/custom-pages',
    body: CreateCustomPageSchema,
    responses: {
      201: CustomPageSchema,
    },
    summary: 'Create custom page',
  },
  updateCustomPage: {
    method: 'PUT',
    path: '/admin/custom-pages',
    body: UpdateCustomPageSchema,
    responses: {
      200: CustomPageSchema,
    },
    summary: 'Update custom page',
  },
  deleteCustomPage: {
    method: 'DELETE',
    path: '/admin/custom-pages',
    query: z.object({ path: z.string() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Delete custom page',
  },
  getCustomPageFolder: {
    method: 'GET',
    path: '/admin/custom-pages/folder',
    query: z.object({ path: z.string() }),
    responses: {
      200: z.any(), // Tree structure
    },
    summary: 'Get custom page folder tree',
  },
  getCustomPageFile: {
    method: 'GET',
    path: '/admin/custom-pages/file',
    query: z.object({ path: z.string(), key: z.string() }),
    responses: {
      200: z.string(),
    },
    summary: 'Get custom page file content',
  },
  createCustomPageFile: {
    method: 'POST',
    path: '/admin/custom-pages/file',
    query: z.object({ path: z.string(), subPath: z.string() }),
    body: z.object({}),
    responses: {
      201: z.object({ success: z.boolean() }),
    },
    summary: 'Create custom page file/folder',
  },
  updateCustomPageFile: {
    method: 'PUT',
    path: '/admin/custom-pages/file',
    body: z.object({
      pathname: z.string(),
      filePath: z.string(),
      content: z.string(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Update custom page file content',
  },
  // Pipeline
  getPipelines: {
    method: 'GET',
    path: '/admin/pipelines',
    responses: {
      200: z.array(PipelineSchema),
    },
    summary: 'Get all pipelines',
  },
  getPipelineConfig: {
    method: 'GET',
    path: '/admin/pipelines/config',
    responses: {
      200: z.any(),
    },
    summary: 'Get pipeline config',
  },
  getPipeline: {
    method: 'GET',
    path: '/admin/pipelines/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: PipelineSchema,
    },
    summary: 'Get pipeline',
  },
  updatePipeline: {
    method: 'PUT',
    path: '/admin/pipelines/:id',
    pathParams: z.object({ id: z.string() }),
    body: UpdatePipelineSchema,
    responses: {
      200: PipelineSchema,
    },
    summary: 'Update pipeline',
  },
  deletePipeline: {
    method: 'DELETE',
    path: '/admin/pipelines/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Delete pipeline',
  },
  createPipeline: {
    method: 'POST',
    path: '/admin/pipelines',
    body: CreatePipelineSchema,
    responses: {
      201: PipelineSchema,
    },
    summary: 'Create pipeline',
  },
  triggerPipeline: {
    method: 'POST',
    path: '/admin/pipelines/:id/trigger',
    pathParams: z.object({ id: z.string() }),
    body: z.any(),
    responses: {
      200: z.any(),
    },
    summary: 'Trigger pipeline',
  },
  // Analytics (Admin)
  getAnalyticsOverview: {
    method: 'GET',
    path: '/admin/analytics/overview',
    query: z.object({
      tab: z.string(),
      overviewNum: z.coerce.number().optional(),
      viewNum: z.coerce.number().optional(),
      articleTabNum: z.coerce.number().optional(),
    }),
    responses: {
      200: z.any(),
    },
    summary: 'Get analytics overview',
  },
  getAnalyticsLogs: {
    method: 'GET',
    path: '/admin/analytics/logs',
    query: z.object({
      event: z.string(),
      page: z.coerce.number(),
      pageSize: z.coerce.number(),
    }),
    responses: {
      200: z.object({
        items: z.array(AnalyticsLogSchema),
        total: z.number(),
      }),
    },
    summary: 'Get analytics logs',
  },
  // Meta & Backup
  getVersion: {
    method: 'GET',
    path: '/admin/meta/version',
    responses: {
      200: VersionInfoSchema,
    },
    summary: 'Get version info',
  },
  init: {
    method: 'POST',
    path: '/public/init',
    body: InitSchema,
    responses: {
      201: z.object({ success: z.boolean() }),
    },
    summary: 'Initialize system',
  },
  importBackup: {
    method: 'POST',
    path: '/admin/backup/import',
    body: z.any(), // Multipart
    contentType: 'multipart/form-data',
    responses: {
      201: z.object({ success: z.boolean() }),
    },
    summary: 'Import backup',
  },
  exportBackup: {
    method: 'GET',
    path: '/admin/backup/export',
    responses: {
      200: z.any(), // Blob
    },
    summary: 'Export backup',
  },
  restoreBackup: {
    method: 'POST',
    path: '/admin/backup/restore',
    body: z.any(),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Restore backup',
  },
  triggerISR: {
    method: 'POST',
    path: '/admin/isr/trigger',
    body: z.object({}),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: 'Trigger ISR',
  },
  // Public
  getPublicArticles: {
    method: 'GET',
    path: '/articles',
    query: z.object({
      page: z.coerce.number().optional(),
      pageSize: z.coerce.number().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['ASC', 'DESC']).optional(),
      category: z.string().optional(),
      tag: z.string().optional(),
      keyword: z.string().optional(),
    }),
    responses: {
      200: z.object({
        items: z.array(ArticleSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
      }),
    },
    summary: 'Get public articles',
  },
  getPublicArticle: {
    method: 'GET',
    path: '/articles/:idOrPathname',
    pathParams: z.object({ idOrPathname: z.string() }),
    responses: {
      200: z.object({
        article: ArticleSchema,
        pre: ArticleSchema.nullable().optional(),
        next: ArticleSchema.nullable().optional(),
      }),
    },
    summary: 'Get public article',
  },
  getEncryptedArticle: {
    method: 'POST',
    path: '/articles/:id/verify-password',
    pathParams: z.object({ id: z.string() }),
    body: z.object({ password: z.string() }),
    responses: {
      200: ArticleSchema,
    },
    summary: 'Get encrypted article',
  },
  getPublicTimeline: {
    method: 'GET',
    path: '/public/timeline',
    responses: {
      200: z.record(z.string(), z.array(ArticleSchema)),
    },
    summary: 'Get public timeline',
  },
  getPublicCategories: {
    method: 'GET',
    path: '/articles/grouped-by-category',
    responses: {
      200: z.record(z.string(), z.array(ArticleSchema)),
    },
    summary: 'Get public categories',
  },
  getPublicTags: {
    method: 'GET',
    path: '/articles/grouped-by-tag',
    responses: {
      200: z.record(z.string(), z.array(ArticleSchema)),
    },
    summary: 'Get public tags',
  },
  searchPublicArticles: {
    method: 'GET',
    path: '/articles/search',
    query: z.object({ keyword: z.string() }),
    responses: {
      200: z.object({
        items: z.array(ArticleSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
      }),
    },
    summary: 'Search public articles',
  },
  getPublicMeta: {
    method: 'GET',
    path: '/public/bootstrap',
    responses: {
      200: z.any(), // PublicMetaProp
    },
    summary: 'Get public meta',
  },
  getPublicCustomPages: {
    method: 'GET',
    path: '/public/customPage/all',
    responses: {
      200: z.array(CustomPageListSchema),
    },
    summary: 'Get public custom pages',
  },
  getPublicCustomPage: {
    method: 'GET',
    path: '/public/customPage',
    query: z.object({ path: z.string() }),
    responses: {
      200: PublicCustomPageSchema,
    },
    summary: 'Get public custom page',
  },
  getPublicViewer: {
    method: 'GET',
    path: '/analytics/public/overview',
    responses: {
      200: z.object({
        totalPageviews: z.number(),
        totalVisitors: z.number(),
      }),
    },
    summary: 'Get public viewer stats',
  },
  getArticleViewer: {
    method: 'GET',
    path: '/analytics/public/article/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: z
        .object({
          articleId: z.number(),
          title: z.string(),
          views: z.number(),
          uniqueVisitors: z.number(),
          avgReadTime: z.number(),
        })
        .nullable(),
    },
    summary: 'Get article viewer stats',
  },
  recordPublicViewer: {
    method: 'POST',
    path: '/analytics/record',
    body: z.object({
      type: z.string(),
      path: z.string().optional(),
      referrer: z.string().optional(),
      userAgent: z.string().optional(),
      data: z.any().optional(),
    }),
    responses: {
      201: z.void(),
    },
    summary: 'Record public viewer',
  },
  // Site Info
  getSiteInfo: {
    method: 'GET',
    path: '/admin/settings/site-info',
    responses: {
      200: SiteInfoSchema,
    },
    summary: 'Get site information',
  },
  updateSiteInfo: {
    method: 'PUT',
    path: '/admin/settings/site-info',
    body: UpdateSiteInfoSchema,
    responses: {
      200: SiteInfoSchema,
    },
    summary: 'Update site information',
  },
  // Layout
  getLayoutSettings: {
    method: 'GET',
    path: '/admin/settings/layout',
    responses: {
      200: SiteLayoutSchema,
    },
    summary: 'Get layout settings',
  },
  updateLayoutSettings: {
    method: 'PUT',
    path: '/admin/settings/layout',
    body: UpdateLayoutSchema,
    responses: {
      200: SiteLayoutSchema,
    },
    summary: 'Update layout settings',
  },
  // Theme
  getThemeSettings: {
    method: 'GET',
    path: '/admin/settings/theme',
    responses: {
      200: SiteThemeSchema,
    },
    summary: 'Get theme settings',
  },
  updateThemeSettings: {
    method: 'PUT',
    path: '/admin/settings/theme',
    body: UpdateThemeSchema,
    responses: {
      200: SiteThemeSchema,
    },
    summary: 'Update theme settings',
  },
  // Friend Links
  getFriendLinks: {
    method: 'GET',
    path: '/admin/settings/friend-links',
    responses: {
      200: z.array(FriendLinkSchema),
    },
    summary: 'Get friend links',
  },
  createFriendLink: {
    method: 'POST',
    path: '/admin/settings/friend-links',
    body: CreateFriendLinkSchema,
    responses: {
      201: FriendLinkSchema,
    },
    summary: 'Create friend link',
  },
  updateFriendLink: {
    method: 'PUT',
    path: '/admin/settings/friend-links/:index',
    pathParams: z.object({
      index: z.coerce.number(),
    }),
    body: UpdateFriendLinkSchema,
    responses: {
      200: FriendLinkSchema,
    },
    summary: 'Update friend link',
  },
  deleteFriendLink: {
    method: 'DELETE',
    path: '/admin/settings/friend-links/:index',
    pathParams: z.object({
      index: z.coerce.number(),
    }),
    body: z.object({}),
    responses: {
      200: z.array(FriendLinkSchema),
    },
    summary: 'Delete friend link',
  },
  // Navigation
  getNavigation: {
    method: 'GET',
    path: '/admin/settings/navigation',
    responses: {
      200: z.array(NavigationSchema),
    },
    summary: 'Get navigation menu',
  },
  updateNavigation: {
    method: 'PUT',
    path: '/admin/settings/navigation',
    body: UpdateNavigationSchema,
    responses: {
      200: z.array(NavigationSchema),
    },
    summary: 'Update navigation menu',
  },
  // Custom Code
  getCustomCode: {
    method: 'GET',
    path: '/admin/settings/custom-code',
    responses: {
      200: CustomCodeSchema,
    },
    summary: 'Get custom code',
  },
  updateCustomCode: {
    method: 'PUT',
    path: '/admin/settings/custom-code',
    body: UpdateCustomCodeSchema,
    responses: {
      200: CustomCodeSchema,
    },
    summary: 'Update custom code',
  },
  // About
  getAboutInfo: {
    method: 'GET',
    path: '/admin/settings/about',
    responses: {
      200: AboutInfoSchema,
    },
    summary: 'Get about information',
  },
  updateAboutInfo: {
    method: 'PUT',
    path: '/admin/settings/about',
    body: UpdateAboutSchema,
    responses: {
      200: AboutInfoSchema,
    },
    summary: 'Update about information',
  },
  // Social
  getSocials: {
    method: 'GET',
    path: '/admin/settings/social',
    responses: {
      200: z.array(SocialItemSchema),
    },
    summary: 'Get social links',
  },
  updateSocial: {
    method: 'PUT',
    path: '/admin/settings/social',
    body: UpdateSocialSchema,
    responses: {
      200: z.array(SocialItemSchema),
    },
    summary: 'Update social link',
  },
  deleteSocial: {
    method: 'DELETE',
    path: '/admin/settings/social/:type',
    pathParams: z.object({
      type: SocialTypeEnum,
    }),
    responses: {
      200: z.array(SocialItemSchema),
    },
    summary: 'Delete social link',
  },
  getSocialTypes: {
    method: 'GET',
    path: '/admin/settings/social/types',
    responses: {
      200: z.array(SocialTypeInfoSchema),
    },
    summary: 'Get available social types',
  },
  // Waline
  getWalineSetting: {
    method: 'GET',
    path: '/admin/settings/waline',
    responses: {
      200: WalineSettingSchema,
    },
    summary: 'Get Waline settings',
  },
  updateWalineSetting: {
    method: 'PUT',
    path: '/admin/settings/waline',
    body: UpdateWalineSettingSchema,
    responses: {
      200: WalineSettingSchema,
    },
    summary: 'Update Waline settings',
  },
  // ISR
  getISRSetting: {
    method: 'GET',
    path: '/admin/settings/isr',
    responses: {
      200: ISRSettingSchema,
    },
    summary: 'Get ISR settings',
  },
  updateISRSetting: {
    method: 'PUT',
    path: '/admin/settings/isr',
    body: UpdateISRSettingSchema,
    responses: {
      200: ISRSettingSchema,
    },
    summary: 'Update ISR settings',
  },
  // Login
  getLoginSetting: {
    method: 'GET',
    path: '/admin/settings/login',
    responses: {
      200: LoginSettingSchema,
    },
    summary: 'Get Login settings',
  },
  updateLoginSetting: {
    method: 'PUT',
    path: '/admin/settings/login',
    body: UpdateLoginSettingSchema,
    responses: {
      200: LoginSettingSchema,
    },
    summary: 'Update Login settings',
  },
  // HTTPS
  getHttpsSetting: {
    method: 'GET',
    path: '/admin/settings/https',
    responses: {
      200: HttpsSettingSchema,
    },
    summary: 'Get HTTPS settings',
  },
  updateHttpsSetting: {
    method: 'PUT',
    path: '/admin/settings/https',
    body: UpdateHttpsSettingSchema,
    responses: {
      200: HttpsSettingSchema,
    },
    summary: 'Update HTTPS settings',
  },
  // Static
  getStaticSetting: {
    method: 'GET',
    path: '/admin/settings/static',
    responses: {
      200: StaticSettingSchema,
    },
    summary: 'Get Static (Media) settings',
  },
  updateStaticSetting: {
    method: 'PUT',
    path: '/admin/settings/static',
    body: UpdateStaticSettingSchema,
    responses: {
      200: StaticSettingSchema,
    },
    summary: 'Update Static (Media) settings',
  },
  // Rewards
  getRewards: {
    method: 'GET',
    path: '/admin/settings/donations',
    responses: {
      200: z.array(RewardItemSchema),
    },
    summary: 'Get donation (reward) settings',
  },
  createReward: {
    method: 'POST',
    path: '/admin/settings/donations',
    body: CreateRewardSchema,
    responses: {
      201: RewardItemSchema,
    },
    summary: 'Create donation (reward) setting',
  },
  updateReward: {
    method: 'PUT',
    path: '/admin/settings/donations/:name',
    pathParams: z.object({
      name: z.string(),
    }),
    body: UpdateRewardSchema,
    responses: {
      200: RewardItemSchema,
    },
    summary: 'Update donation (reward) setting',
  },
  deleteReward: {
    method: 'DELETE',
    path: '/admin/settings/donations/:name',
    pathParams: z.object({
      name: z.string(),
    }),
    responses: {
      200: z.any(),
    },
    summary: 'Delete donation (reward) setting',
  },
  // Caddy
  getCaddyLog: {
    method: 'GET',
    path: '/admin/caddy/logs',
    responses: {
      200: CaddyLogSchema,
    },
    summary: 'Get Caddy logs',
  },
  clearCaddyLog: {
    method: 'DELETE',
    path: '/admin/caddy/logs',
    body: z.object({}),
    responses: {
      200: z.string(),
    },
    summary: 'Clear Caddy logs',
  },
  getCaddyConfig: {
    method: 'GET',
    path: '/admin/caddy/config',
    responses: {
      200: CaddyConfigSchema,
    },
    summary: 'Get Caddy config',
  },
});
