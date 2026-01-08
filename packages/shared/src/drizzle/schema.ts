import { nowIsoTz } from '../dayjs.js';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  nickname: text('nickname'),
  email: text('email'),
  avatar: text('avatar'),
  type: text('type', { enum: ['admin', 'editor', 'author', 'subscriber', 'viewer'] })
    .notNull()
    .default('subscriber'),
  permissions: text('permissions', { mode: 'json' }).$type<string[] | null>(),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => nowIsoTz()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => nowIsoTz()),
});

// Articles table
export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    pathname: text('pathname').unique(),
    tags: text('tags', { mode: 'json' }).$type<string[] | null>(),
    category: text('category').references(() => categories.name, {
      onUpdate: 'cascade',
      onDelete: 'set null',
    }),
    author: text('author').notNull(),
    top: integer('top').default(0),
    hidden: integer('hidden', { mode: 'boolean' }).default(false),
    private: integer('private', { mode: 'boolean' }).default(false),
    password: text('password'),
    viewer: integer('viewer').default(0),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('pathname_idx').on(table.pathname),
    index('category_idx').on(table.category),
    index('created_at_idx').on(table.createdAt),
    index('updated_at_idx').on(table.updatedAt),
    index('author_idx').on(table.author),
    index('hidden_idx').on(table.hidden),
    index('private_idx').on(table.private),
    index('top_idx').on(table.top),
    // 复合索引用于常见查询组合
    index('category_hidden_idx').on(table.category, table.hidden),
    index('author_created_at_idx').on(table.author, table.createdAt),
    index('hidden_created_at_idx').on(table.hidden, table.createdAt),
  ],
);

// Categories table
export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    slug: text('slug').unique(),
    description: text('description'),
    private: integer('private', { mode: 'boolean' }).default(false),
    password: text('password'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('categories_slug_idx').on(table.slug),
    index('categories_private_idx').on(table.private),
    index('categories_created_at_idx').on(table.createdAt),
  ],
);

// Tags table
export const tags = sqliteTable(
  'tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    slug: text('slug').unique(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('tags_slug_idx').on(table.slug),
    index('tags_created_at_idx').on(table.createdAt),
  ],
);

// Article Tags (Many-to-Many) - Junction table
export const articleTags = sqliteTable(
  'article_tags',
  {
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagName: text('tag_name')
      .notNull()
      .references(() => tags.name, { onUpdate: 'cascade', onDelete: 'cascade' }),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('article_tags_article_id_idx').on(table.articleId),
    index('article_tags_tag_name_idx').on(table.tagName),
    uniqueIndex('article_tags_unique').on(table.articleId, table.tagName),
  ],
);

// Draft Tags (Many-to-Many) - Junction table
export const draftTags = sqliteTable(
  'draft_tags',
  {
    draftId: integer('draft_id')
      .notNull()
      .references(() => drafts.id, { onDelete: 'cascade' }),
    tagName: text('tag_name')
      .notNull()
      .references(() => tags.name, { onUpdate: 'cascade', onDelete: 'cascade' }),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('draft_tags_draft_id_idx').on(table.draftId),
    index('draft_tags_tag_name_idx').on(table.tagName),
    uniqueIndex('draft_tags_unique').on(table.draftId, table.tagName),
  ],
);

// Drafts table
export const drafts = sqliteTable(
  'drafts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    pathname: text('pathname'),
    tags: text('tags', { mode: 'json' }).$type<string[] | null>(),
    category: text('category'),
    author: text('author').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('drafts_author_idx').on(table.author),
    index('drafts_category_idx').on(table.category),
    index('drafts_pathname_idx').on(table.pathname),
    index('drafts_created_at_idx').on(table.createdAt),
    index('drafts_updated_at_idx').on(table.updatedAt),
    // 复合索引用于常见查询组合
    index('drafts_author_created_at_idx').on(table.author, table.createdAt),
    index('drafts_category_created_at_idx').on(table.category, table.createdAt),
  ],
);

// Draft versions table
export const draftVersions = sqliteTable(
  'draft_versions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    draftId: integer('draft_id').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    pathname: text('pathname'),
    tags: text('tags', { mode: 'json' }).$type<string[] | null>(),
    category: text('category'),
    author: text('author').notNull(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('draft_id_idx').on(table.draftId),
    index('draft_version_idx').on(table.draftId, table.version),
  ],
);

// Images/Static files table
export const staticFiles = sqliteTable(
  'static_files',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    filename: text('filename').notNull(),
    path: text('path').notNull(),
    size: integer('size').notNull(),
    mimeType: text('mime_type'),
    width: integer('width'),
    height: integer('height'),
    hash: text('hash'),
    provider: text('provider').default('local'), // local, oss, etc.
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('static_files_filename_idx').on(table.filename),
    index('static_files_path_idx').on(table.path),
    index('static_files_mime_type_idx').on(table.mimeType),
    index('static_files_provider_idx').on(table.provider),
    index('static_files_hash_idx').on(table.hash),
    index('static_files_created_at_idx').on(table.createdAt),
    index('static_files_size_idx').on(table.size),
    // 复合索引用于常见查询组合
    index('static_files_provider_created_at_idx').on(table.provider, table.createdAt),
    index('static_files_mime_type_created_at_idx').on(table.mimeType, table.createdAt),
  ],
);

// Site metadata table
export const siteMeta = sqliteTable(
  'site_meta',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull().unique(),
    value: text('value', { mode: 'json' }).$type<unknown>(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('site_meta_key_idx').on(table.key),
    index('site_meta_created_at_idx').on(table.createdAt),
    index('site_meta_updated_at_idx').on(table.updatedAt),
  ],
);

// Login logs table
export const loginLogs = sqliteTable(
  'login_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    success: integer('success', { mode: 'boolean' }).notNull(),
    message: text('message'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('username_idx').on(table.username),
    index('login_created_at_idx').on(table.createdAt),
  ],
);

// Custom pages table
export const customPages = sqliteTable(
  'custom_pages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    pathname: text('pathname').notNull().unique(),
    content: text('content').notNull(),
    type: text('type', { enum: ['html', 'markdown'] })
      .notNull()
      .default('markdown'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('custom_pages_pathname_idx').on(table.pathname),
    index('custom_pages_type_idx').on(table.type),
    index('custom_pages_created_at_idx').on(table.createdAt),
    index('custom_pages_updated_at_idx').on(table.updatedAt),
  ],
);

// Analytics table
export const analytics = sqliteTable(
  'analytics',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(), // pageview, event, etc.
    path: text('path'),
    referrer: text('referrer'),
    userAgent: text('user_agent'),
    ip: text('ip'),
    data: text('data', { mode: 'json' }).$type<unknown>(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('analytics_type_idx').on(table.type),
    index('analytics_path_idx').on(table.path),
    index('analytics_created_at_idx').on(table.createdAt),
    // Composite indexes for better query performance
    index('analytics_type_created_at_idx').on(table.type, table.createdAt),
    index('analytics_path_created_at_idx').on(table.path, table.createdAt),
    index('analytics_type_path_idx').on(table.type, table.path),
  ],
);

// Permission nodes table
export const permissionNodes = sqliteTable(
  'permission_nodes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(), // 权限节点名称，如 'article:read'
    description: text('description'), // 权限描述
    module: text('module').notNull(), // 所属模块，如 'article', 'draft'
    isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否启用
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('permission_nodes_name_idx').on(table.name),
    index('permission_nodes_module_idx').on(table.module),
    index('permission_nodes_is_active_idx').on(table.isActive),
    index('permission_nodes_module_active_idx').on(table.module, table.isActive),
  ],
);

// Permission groups table
export const permissionGroups = sqliteTable(
  'permission_groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(), // 权限组名称，如 'admin', 'editor'
    description: text('description'), // 权限组描述
    permissions: text('permissions', { mode: 'json' }).$type<string[] | null>(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否启用
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('permission_groups_name_idx').on(table.name),
    index('permission_groups_is_active_idx').on(table.isActive),
  ],
);

// Plugin data storage table
export const pluginData = sqliteTable(
  'plugin_data',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    pluginId: text('plugin_id').notNull(),
    key: text('key').notNull(),
    value: text('value'), // JSON string for any data type
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('plugin_data_plugin_id_idx').on(table.pluginId),
    index('plugin_data_key_idx').on(table.pluginId, table.key),
    // Add unique constraint for plugin_id and key combination
    uniqueIndex('plugin_data_unique_idx').on(table.pluginId, table.key),
  ],
);

// Webhooks table
export const webhooks = sqliteTable('webhooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  events: text('events', { mode: 'json' }).$type<string[]>().notNull(),
  secret: text('secret'), // Optional secret for signature verification
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  retryCount: integer('retry_count').notNull().default(3),
  timeout: integer('timeout').notNull().default(30000), // 30 seconds
  lastTriggered: text('last_triggered'),
  lastStatus: text('last_status'), // 'success', 'failed', 'timeout'
  lastError: text('last_error'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => nowIsoTz()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => nowIsoTz()),
});

export const webhookLogs = sqliteTable(
  'webhook_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    webhookId: integer('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    payload: text('payload', { mode: 'json' }).$type<unknown>().notNull(),
    status: text('status').notNull(), // 'success', 'failed', 'timeout'
    responseCode: integer('response_code'),
    responseBody: text('response_body'),
    error: text('error'),
    duration: integer('duration'), // milliseconds
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('webhook_logs_webhook_id_idx').on(table.webhookId),
    index('webhook_logs_event_idx').on(table.event),
    index('webhook_logs_created_at_idx').on(table.createdAt),
  ],
);

// Image processing queue table
export const imageProcessingQueue = sqliteTable('image_processing_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileId: integer('file_id').notNull(),
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] })
    .notNull()
    .default('pending'),
  priority: integer('priority').notNull().default(0), // 高数值 = 高优先级
  processingConfig: text('processing_config', { mode: 'json' }), // JSON 配置
  originalBuffer: text('original_buffer'), // Base64 编码的原始文件
  processedBuffer: text('processed_buffer'), // Base64 编码的处理后文件
  errorMessage: text('error_message'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
});

// Token blacklist table for revoked JWT tokens
export const tokenBlacklist = sqliteTable(
  'token_blacklist',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tokenHash: text('token_hash').notNull().unique(), // SHA-256 hash of the token
    tokenType: text('token_type', { enum: ['access', 'refresh'] }).notNull(),
    userId: integer('user_id'), // Optional: for user-specific revocations
    reason: text('reason'), // Optional: revocation reason
    expiresAt: text('expires_at').notNull(), // When the original token expires
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('token_blacklist_hash_idx').on(table.tokenHash),
    index('token_blacklist_type_idx').on(table.tokenType),
    index('token_blacklist_user_id_idx').on(table.userId),
    index('token_blacklist_expires_at_idx').on(table.expiresAt),
    index('token_blacklist_created_at_idx').on(table.createdAt),
    // Composite indexes for better query performance
    index('token_blacklist_type_user_idx').on(table.tokenType, table.userId),
    index('token_blacklist_expires_created_idx').on(table.expiresAt, table.createdAt),
  ],
);

// Pipelines table
export const pipelines = sqliteTable(
  'pipelines',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    eventName: text('event_name').notNull(),
    script: text('script').notNull(),
    deps: text('deps', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    status: text('status', { enum: ['idle', 'running', 'success', 'error'] })
      .notNull()
      .default('idle'),
    lastRun: text('last_run'),
    lastStatus: text('last_status'),
    lastError: text('last_error'),
    deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => nowIsoTz()),
  },
  (table) => [
    index('pipelines_event_name_idx').on(table.eventName),
    index('pipelines_enabled_idx').on(table.enabled),
    index('pipelines_deleted_idx').on(table.deleted),
    index('pipelines_status_idx').on(table.status),
    index('pipelines_created_at_idx').on(table.createdAt),
    // Composite indexes for common queries
    index('pipelines_event_enabled_idx').on(table.eventName, table.enabled, table.deleted),
  ],
);

// Type exports
export type ImageProcessingQueueInsert = typeof imageProcessingQueue.$inferInsert;
export type ImageProcessingQueueSelect = typeof imageProcessingQueue.$inferSelect;
