import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  nickname: text('nickname'),
  email: text('email'),
  avatar: text('avatar'),
  type: text('type', { enum: ['admin', 'editor', 'author', 'subscriber'] })
    .notNull()
    .default('subscriber'),
  permissions: text('permissions'), // JSON string for permissions array
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Articles table
export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    pathname: text('pathname').unique(),
    tags: text('tags'), // JSON string for tags array
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
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('pathname_idx').on(table.pathname),
    index('category_idx').on(table.category),
    index('created_at_idx').on(table.createdAt),
  ],
);

// Categories table
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  slug: text('slug').unique(),
  description: text('description'),
  private: integer('private', { mode: 'boolean' }).default(false),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Tags table
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  slug: text('slug').unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Drafts table
export const drafts = sqliteTable('drafts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  pathname: text('pathname'),
  tags: text('tags'), // JSON string
  category: text('category'),
  author: text('author').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

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
    tags: text('tags'), // JSON string
    category: text('category'),
    author: text('author').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
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
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('filename_idx').on(table.filename)],
);

// Site metadata table
export const siteMeta = sqliteTable('site_meta', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'), // JSON string for complex values
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

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
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('username_idx').on(table.username),
    index('login_created_at_idx').on(table.createdAt),
  ],
);

// Custom pages table
export const customPages = sqliteTable('custom_pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  pathname: text('pathname').notNull().unique(),
  content: text('content').notNull(),
  type: text('type', { enum: ['html', 'markdown'] })
    .notNull()
    .default('markdown'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

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
    data: text('data'), // JSON string for additional data
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('analytics_type_idx').on(table.type),
    index('analytics_path_idx').on(table.path),
    index('analytics_created_at_idx').on(table.createdAt),
  ],
);

// Permission nodes table
export const permissionNodes = sqliteTable('permission_nodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(), // 权限节点名称，如 'article:read'
  description: text('description'), // 权限描述
  module: text('module').notNull(), // 所属模块，如 'article', 'draft'
  isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否启用
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Permission groups table
export const permissionGroups = sqliteTable('permission_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(), // 权限组名称，如 'admin', 'editor'
  description: text('description'), // 权限组描述
  permissions: text('permissions'), // JSON string for permissions array
  isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否启用
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Plugin data storage table
export const pluginData = sqliteTable(
  'plugin_data',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    pluginId: text('plugin_id').notNull(),
    key: text('key').notNull(),
    value: text('value'), // JSON string for any data type
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('plugin_data_plugin_id_idx').on(table.pluginId),
    index('plugin_data_key_idx').on(table.pluginId, table.key),
    // Add unique constraint for plugin_id and key combination
    uniqueIndex('plugin_data_unique_idx').on(table.pluginId, table.key),
  ],
);

// Code snippets table for plugin system
export const codeSnippets = sqliteTable(
  'code_snippets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    hookName: text('hook_name').notNull(), // The hook this snippet listens to
    hookType: text('hook_type', { enum: ['action', 'filter'] })
      .notNull()
      .default('action'),
    priority: integer('priority').notNull().default(10), // Hook execution priority
    code: text('code').notNull(), // JavaScript code to execute
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    timeout: integer('timeout').notNull().default(5000), // Execution timeout in ms
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('code_snippets_hook_name_idx').on(table.hookName),
    index('code_snippets_enabled_idx').on(table.enabled),
  ],
);
