/**
 * Test Data Factory Functions
 *
 * This file provides factory functions for creating test data entities.
 * Each factory accepts an optional `overrides` parameter to customize fields.
 *
 * Pattern:
 * - Provide sensible defaults for all required fields
 * - Accept optional overrides object
 * - Return complete entity object matching database schema
 * - Use spread operator to merge: { ...defaults, ...overrides }
 *
 * @example
 * const user = createMockUser({ username: 'customuser' });
 * const article = createMockArticle({ title: 'Custom Title', viewer: 100 });
 */

import { dayjs } from '@vanblog/shared';

import { generateTestId } from '../test-utils';

/**
 * ID 生成器 - 为测试数据生成唯一 ID
 * 使用共享的 generateTestId() 确保跨文件的 ID 唯一性
 */
function generateUniqueId(prefix: string = ''): number {
  const id = generateTestId();
  return parseInt(`${prefix}${String(id)}`.slice(-10)); // 保留最后10位作为 ID
}

/**
 * 生成唯一字符串后缀（用于 UNIQUE 字段）
 */
function generateUniqueSuffix(): string {
  return String(generateTestId());
}

// ============ User Entity ============

export interface MockUser {
  id: number;
  username: string;
  password: string;
  nickname: string | null;
  email: string | null;
  avatar: string | null;
  type: 'admin' | 'editor' | 'author' | 'subscriber' | 'viewer';
  permissions: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('1'),
    username: overrides.username ?? `testuser-${suffix}`,
    password: overrides.password ?? '$2b$10$hashedpassword', // Bcrypt hashed password
    nickname: overrides.nickname !== undefined ? overrides.nickname : 'Test User',
    email: overrides.email ?? `test-${suffix}@example.com`,
    avatar: overrides.avatar !== undefined ? overrides.avatar : null,
    type: overrides.type ?? 'admin',
    permissions: overrides.permissions !== undefined ? overrides.permissions : null,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Article Entity ============

export interface MockArticle {
  id: number;
  title: string;
  content: string;
  pathname: string | null;
  tags: string[] | null;
  category: string | null;
  author: string;
  top: number;
  hidden: boolean;
  private: boolean;
  password: string | null;
  viewer: number;
  createdAt: string;
  updatedAt: string;
}

export const createMockArticle = (overrides: Partial<MockArticle> = {}): MockArticle => {
  const uniqueId = overrides.id ?? generateUniqueId('1');
  const suffix = generateUniqueSuffix();
  return {
    id: uniqueId,
    title: overrides.title ?? 'Test Article',
    content: overrides.content ?? 'This is a test article content with **markdown** support.',
    pathname: overrides.pathname !== undefined ? overrides.pathname : `/article-${suffix}`,
    tags: overrides.tags !== undefined ? overrides.tags : ['test', 'demo'],
    category: overrides.category !== undefined ? overrides.category : null,
    author: overrides.author ?? 'admin',
    top: overrides.top ?? 0,
    hidden: overrides.hidden ?? false,
    private: overrides.private ?? false,
    password: overrides.password !== undefined ? overrides.password : null,
    viewer: overrides.viewer ?? 0,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Tag Entity ============

export interface MockTag {
  id: number;
  name: string;
  slug: string | null;
  createdAt: string;
}

export const createMockTag = (overrides: Partial<MockTag> = {}): MockTag => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('4'),
    name: overrides.name ?? `Test Tag ${suffix}`,
    slug: overrides.slug ?? `test-tag-${suffix}`,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Category Entity ============

export interface MockCategory {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  private: boolean;
  password: string | null;
  createdAt: string;
  updatedAt: string;
}

export const createMockCategory = (overrides: Partial<MockCategory> = {}): MockCategory => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('3'),
    name: overrides.name ?? `Test Category ${suffix}`,
    slug: overrides.slug ?? `test-category-${suffix}`,
    description:
      overrides.description !== undefined ? overrides.description : 'This is a test category',
    private: overrides.private ?? false,
    password: overrides.password !== undefined ? overrides.password : null,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Draft Entity ============

export interface MockDraft {
  id: number;
  title: string;
  content: string;
  pathname: string | null;
  tags: string[] | null;
  category: string | null;
  author: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const createMockDraft = (overrides: Partial<MockDraft> = {}): MockDraft => {
  const uniqueId = overrides.id ?? generateUniqueId('2');
  const suffix = generateUniqueSuffix();
  return {
    id: uniqueId,
    title: overrides.title ?? 'Test Draft',
    content: overrides.content ?? 'This is a draft article content.',
    pathname: overrides.pathname !== undefined ? overrides.pathname : `/draft-${suffix}`,
    tags: overrides.tags !== undefined ? overrides.tags : ['draft', 'wip'],
    category: overrides.category !== undefined ? overrides.category : null,
    author: overrides.author ?? 'admin',
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Draft Version Entity ============

export interface MockDraftVersion {
  id: number;
  draftId: number;
  version: number;
  title: string;
  content: string;
  pathname: string | null;
  tags: string[] | null;
  category: string | null;
  author: string;
  createdAt: string;
}

export const createMockDraftVersion = (
  overrides: Partial<MockDraftVersion> = {},
): MockDraftVersion => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('5'),
    draftId: overrides.draftId ?? generateUniqueId('2'),
    version: overrides.version ?? 1,
    title: overrides.title ?? 'Test Draft Version',
    content: overrides.content ?? 'Version 1 content',
    pathname: overrides.pathname !== undefined ? overrides.pathname : `/draft-version-${suffix}`,
    tags: overrides.tags !== undefined ? overrides.tags : ['draft'],
    category: overrides.category !== undefined ? overrides.category : null,
    author: overrides.author ?? 'admin',
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Media (Static Files) Entity ============

export interface MockMedia {
  id: number;
  filename: string;
  path: string;
  size: number;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  hash: string | null;
  provider: string;
  createdAt: string;
}

export const createMockMedia = (overrides: Partial<MockMedia> = {}): MockMedia => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('6'),
    filename: overrides.filename ?? `test-image-${suffix}.jpg`,
    path: overrides.path ?? `/uploads/images/test-image-${suffix}.jpg`,
    size: overrides.size ?? 102400,
    mimeType: overrides.mimeType !== undefined ? overrides.mimeType : 'image/jpeg',
    width: overrides.width !== undefined ? overrides.width : 1920,
    height: overrides.height !== undefined ? overrides.height : 1080,
    hash: overrides.hash !== undefined ? overrides.hash : `hash-${suffix}`,
    provider: overrides.provider ?? 'local',
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Webhook Entity ============

export interface MockWebhook {
  id: number;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  active: boolean;
  retryCount: number;
  timeout: number;
  lastTriggered: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export const createMockWebhook = (overrides: Partial<MockWebhook> = {}): MockWebhook => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('7'),
    name: overrides.name ?? `webhook-${suffix}`,
    url: overrides.url ?? `https://example.com/webhook-${suffix}`,
    events: overrides.events ?? ['article|afterCreate', 'article|afterUpdate'],
    secret: overrides.secret !== undefined ? overrides.secret : `secret-${suffix}`,
    active: overrides.active ?? true,
    retryCount: overrides.retryCount ?? 3,
    timeout: overrides.timeout ?? 30000,
    lastTriggered: overrides.lastTriggered !== undefined ? overrides.lastTriggered : null,
    lastStatus: overrides.lastStatus !== undefined ? overrides.lastStatus : null,
    lastError: overrides.lastError !== undefined ? overrides.lastError : null,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Webhook Log Entity ============

export interface MockWebhookLog {
  id: number;
  webhookId: number;
  event: string;
  payload: unknown;
  status: string;
  responseCode: number | null;
  responseBody: string | null;
  error: string | null;
  duration: number | null;
  createdAt: string;
}

export const createMockWebhookLog = (overrides: Partial<MockWebhookLog> = {}): MockWebhookLog => {
  return {
    id: overrides.id ?? generateUniqueId('8'),
    webhookId: overrides.webhookId ?? generateUniqueId('7'),
    event: overrides.event ?? 'article|afterCreate',
    payload: overrides.payload ?? { articleId: generateUniqueId('1'), title: 'Test' },
    status: overrides.status ?? 'success',
    responseCode: overrides.responseCode !== undefined ? overrides.responseCode : 200,
    responseBody:
      overrides.responseBody !== undefined ? overrides.responseBody : '{"success":true}',
    error: overrides.error !== undefined ? overrides.error : null,
    duration: overrides.duration !== undefined ? overrides.duration : 150,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Analytics Entity ============

export interface MockAnalytics {
  id: number;
  type: string;
  path: string | null;
  referrer: string | null;
  userAgent: string | null;
  ip: string | null;
  data: unknown;
  createdAt: string;
}

export const createMockAnalytics = (overrides: Partial<MockAnalytics> = {}): MockAnalytics => {
  return {
    id: overrides.id ?? generateUniqueId('9'),
    type: overrides.type ?? 'page_view',
    path: overrides.path !== undefined ? overrides.path : '/article/test-article',
    referrer: overrides.referrer !== undefined ? overrides.referrer : 'https://google.com',
    userAgent:
      overrides.userAgent !== undefined
        ? overrides.userAgent
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ip: overrides.ip !== undefined ? overrides.ip : '192.168.1.1',
    data: overrides.data ?? { duration: 30 },
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Setting (Site Meta) Entity ============

export interface MockSetting {
  id: number;
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

export const createMockSetting = (overrides: Partial<MockSetting> = {}): MockSetting => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('10'),
    key: overrides.key ?? `site.setting-${suffix}`,
    value: overrides.value ?? 'Test Blog',
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Comment Entity (for Waline integration) ============

export interface MockComment {
  id: number;
  articleId: number;
  parentId: number | null;
  author: string;
  email: string;
  content: string;
  status: 'pending' | 'approved' | 'spam';
  createdAt: string;
  updatedAt: string;
}

export const createMockComment = (overrides: Partial<MockComment> = {}): MockComment => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('11'),
    articleId: overrides.articleId ?? generateUniqueId('1'),
    parentId: overrides.parentId !== undefined ? overrides.parentId : null,
    author: overrides.author ?? 'Commenter',
    email: overrides.email ?? `commenter-${suffix}@example.com`,
    content: overrides.content ?? 'This is a test comment.',
    status: overrides.status ?? 'approved',
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Login Log Entity ============

export interface MockLoginLog {
  id: number;
  username: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  message: string | null;
  createdAt: string;
}

export const createMockLoginLog = (overrides: Partial<MockLoginLog> = {}): MockLoginLog => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('12'),
    username: overrides.username ?? `testuser-${suffix}`,
    ip: overrides.ip !== undefined ? overrides.ip : '192.168.1.1',
    userAgent: overrides.userAgent !== undefined ? overrides.userAgent : 'Mozilla/5.0',
    success: overrides.success ?? true,
    message: overrides.message !== undefined ? overrides.message : null,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Custom Page Entity ============

export interface MockCustomPage {
  id: number;
  title: string;
  pathname: string;
  content: string;
  type: 'html' | 'markdown';
  createdAt: string;
  updatedAt: string;
}

export const createMockCustomPage = (overrides: Partial<MockCustomPage> = {}): MockCustomPage => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('13'),
    title: overrides.title ?? 'About Page',
    pathname: overrides.pathname ?? `/page-${suffix}`,
    content: overrides.content ?? '# About\n\nThis is the about page.',
    type: overrides.type ?? 'markdown',
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Permission Node Entity ============

export interface MockPermissionNode {
  id: number;
  name: string;
  description: string | null;
  module: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createMockPermissionNode = (
  overrides: Partial<MockPermissionNode> = {},
): MockPermissionNode => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('4'),
    name: overrides.name ?? `article:create-${suffix}`,
    description:
      overrides.description !== undefined ? overrides.description : 'Create new articles',
    module: overrides.module ?? 'article',
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Permission Group Entity ============

export interface MockPermissionGroup {
  id: number;
  name: string;
  description: string | null;
  permissions: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createMockPermissionGroup = (
  overrides: Partial<MockPermissionGroup> = {},
): MockPermissionGroup => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('5'),
    name: overrides.name ?? `editors-${suffix}`,
    description: overrides.description !== undefined ? overrides.description : 'Editor group',
    permissions:
      overrides.permissions !== undefined
        ? overrides.permissions
        : ['article:create', 'article:update'],
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Plugin Data Entity ============

export interface MockPluginData {
  id: number;
  pluginId: string;
  key: string;
  value: string | null;
  createdAt: string;
  updatedAt: string;
}

export const createMockPluginData = (overrides: Partial<MockPluginData> = {}): MockPluginData => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('6'),
    pluginId: overrides.pluginId ?? 'test-plugin',
    key: overrides.key ?? `config.enabled-${suffix}`,
    value: overrides.value !== undefined ? overrides.value : 'true',
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Plugin Metadata Entity ============

export interface MockPluginMetadata {
  id: number;
  pluginId: string;
  entityType: string;
  entityId: number;
  metaKey: string;
  metaValue: unknown;
  createdAt: string;
  updatedAt: string;
}

export const createMockPluginMetadata = (
  overrides: Partial<MockPluginMetadata> = {},
): MockPluginMetadata => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('7'),
    pluginId: overrides.pluginId ?? `test-plugin-${suffix}`,
    entityType: overrides.entityType ?? 'article',
    entityId: overrides.entityId ?? generateUniqueId('8'),
    metaKey: overrides.metaKey ?? 'processed',
    metaValue: overrides.metaValue !== undefined ? overrides.metaValue : true,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Image Processing Queue Entity ============

export interface MockImageProcessingQueue {
  id: number;
  fileId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  processingConfig: unknown;
  originalBuffer: string | null;
  processedBuffer: string | null;
  errorMessage: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export const createMockImageProcessingQueue = (
  overrides: Partial<MockImageProcessingQueue> = {},
): MockImageProcessingQueue => {
  return {
    id: overrides.id ?? generateUniqueId('4'),
    fileId: overrides.fileId ?? generateUniqueId('6'),
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 0,
    processingConfig: overrides.processingConfig ?? { width: 800, height: 600 },
    originalBuffer: overrides.originalBuffer !== undefined ? overrides.originalBuffer : null,
    processedBuffer: overrides.processedBuffer !== undefined ? overrides.processedBuffer : null,
    errorMessage: overrides.errorMessage !== undefined ? overrides.errorMessage : null,
    attempts: overrides.attempts ?? 0,
    maxAttempts: overrides.maxAttempts ?? 3,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
    startedAt: overrides.startedAt !== undefined ? overrides.startedAt : null,
    completedAt: overrides.completedAt !== undefined ? overrides.completedAt : null,
  };
};

// ============ Token Blacklist Entity ============

export interface MockTokenBlacklist {
  id: number;
  tokenHash: string;
  tokenType: 'access' | 'refresh';
  userId: number | null;
  reason: string | null;
  expiresAt: string;
  createdAt: string;
}

export const createMockTokenBlacklist = (
  overrides: Partial<MockTokenBlacklist> = {},
): MockTokenBlacklist => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('5'),
    tokenHash: overrides.tokenHash ?? `hash-${suffix}`,
    tokenType: overrides.tokenType ?? 'access',
    userId: overrides.userId !== undefined ? overrides.userId : 1,
    reason: overrides.reason !== undefined ? overrides.reason : null,
    expiresAt: overrides.expiresAt ?? dayjs('2024-12-31').format(),
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Pipeline Entity ============

export interface MockPipeline {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  eventName: string;
  script: string;
  deps: string[];
  status: 'idle' | 'running' | 'success' | 'error';
  lastRun: string | null;
  lastStatus: string | null;
  lastError: string | null;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createMockPipeline = (overrides: Partial<MockPipeline> = {}): MockPipeline => {
  const suffix = generateUniqueSuffix();
  return {
    id: overrides.id ?? generateUniqueId('6'),
    name: overrides.name ?? `pipeline-${suffix}`,
    description: overrides.description !== undefined ? overrides.description : null,
    enabled: overrides.enabled ?? true,
    eventName: overrides.eventName ?? 'article|afterCreate',
    script: overrides.script ?? 'console.log("Hello");',
    deps: overrides.deps ?? [],
    status: overrides.status ?? 'idle',
    lastRun: overrides.lastRun !== undefined ? overrides.lastRun : null,
    lastStatus: overrides.lastStatus !== undefined ? overrides.lastStatus : null,
    lastError: overrides.lastError !== undefined ? overrides.lastError : null,
    deleted: overrides.deleted ?? false,
    createdAt: overrides.createdAt ?? dayjs('2024-01-01').format(),
    updatedAt: overrides.updatedAt ?? dayjs('2024-01-01').format(),
  };
};

// ============ Helper Functions ============

/**
 * Create multiple mock articles with incremental IDs
 */
export const createMockArticles = (
  count: number,
  overrides: Partial<MockArticle> = {},
): MockArticle[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockArticle({
      id:
        overrides.id !== undefined ? overrides.id + index : generateUniqueId(`1-${String(index)}`),
      title: `Test Article ${String(index + 1)}`,
      ...overrides,
    }),
  );
};

/**
 * Create multiple mock tags with incremental IDs
 */
export const createMockTags = (count: number, overrides: Partial<MockTag> = {}): MockTag[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockTag({
      id:
        overrides.id !== undefined ? overrides.id + index : generateUniqueId(`4-${String(index)}`),
      name: `Tag ${String(index + 1)}`,
      slug: `tag-${String(index + 1)}`,
      ...overrides,
    }),
  );
};

/**
 * Create multiple mock categories with incremental IDs
 */
export const createMockCategories = (
  count: number,
  overrides: Partial<MockCategory> = {},
): MockCategory[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockCategory({
      id:
        overrides.id !== undefined ? overrides.id + index : generateUniqueId(`3-${String(index)}`),
      name: `Category ${String(index + 1)}`,
      slug: `category-${String(index + 1)}`,
      ...overrides,
    }),
  );
};

/**
 * Create multiple mock users with incremental IDs
 */
export const createMockUsers = (count: number, overrides: Partial<MockUser> = {}): MockUser[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockUser({
      id:
        overrides.id !== undefined ? overrides.id + index : generateUniqueId(`1-${String(index)}`),
      username: `user${String(index + 1)}`,
      email: `user${String(index + 1)}@example.com`,
      ...overrides,
    }),
  );
};

/**
 * Create multiple mock media files with incremental IDs
 */
export const createMockMediaFiles = (
  count: number,
  overrides: Partial<MockMedia> = {},
): MockMedia[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockMedia({
      id:
        overrides.id !== undefined ? overrides.id + index : generateUniqueId(`6-${String(index)}`),
      filename: `image-${String(index + 1)}.jpg`,
      path: `/uploads/images/image-${String(index + 1)}.jpg`,
      ...overrides,
    }),
  );
};
