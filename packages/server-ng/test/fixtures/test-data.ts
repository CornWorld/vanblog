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

export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: 1,
  username: 'testuser',
  password: '$2b$10$hashedpassword', // Bcrypt hashed password
  nickname: 'Test User',
  email: 'test@example.com',
  avatar: null,
  type: 'admin',
  permissions: null,
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockArticle = (overrides: Partial<MockArticle> = {}): MockArticle => ({
  id: 1,
  title: 'Test Article',
  content: 'This is a test article content with **markdown** support.',
  pathname: null,
  tags: ['test', 'demo'],
  category: null,
  author: 'admin',
  top: 0,
  hidden: false,
  private: false,
  password: null,
  viewer: 0,
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

// ============ Tag Entity ============

export interface MockTag {
  id: number;
  name: string;
  slug: string | null;
  createdAt: string;
}

export const createMockTag = (overrides: Partial<MockTag> = {}): MockTag => ({
  id: 1,
  name: 'Test Tag',
  slug: 'test-tag',
  createdAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockCategory = (overrides: Partial<MockCategory> = {}): MockCategory => ({
  id: 1,
  name: 'Test Category',
  slug: 'test-category',
  description: 'This is a test category',
  private: false,
  password: null,
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockDraft = (overrides: Partial<MockDraft> = {}): MockDraft => ({
  id: 1,
  title: 'Test Draft',
  content: 'This is a draft article content.',
  pathname: null,
  tags: ['draft', 'wip'],
  category: null,
  author: 'admin',
  version: 1,
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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
): MockDraftVersion => ({
  id: 1,
  draftId: 1,
  version: 1,
  title: 'Test Draft Version',
  content: 'Version 1 content',
  pathname: null,
  tags: ['draft'],
  category: null,
  author: 'admin',
  createdAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockMedia = (overrides: Partial<MockMedia> = {}): MockMedia => ({
  id: 1,
  filename: 'test-image.jpg',
  path: '/uploads/images/test-image.jpg',
  size: 102400, // 100 KB
  mimeType: 'image/jpeg',
  width: 1920,
  height: 1080,
  hash: 'abc123def456',
  provider: 'local',
  createdAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockWebhook = (overrides: Partial<MockWebhook> = {}): MockWebhook => ({
  id: 1,
  name: 'Test Webhook',
  url: 'https://example.com/webhook',
  events: ['article|afterCreate', 'article|afterUpdate'],
  secret: 'webhook-secret-key',
  active: true,
  retryCount: 3,
  timeout: 30000,
  lastTriggered: null,
  lastStatus: null,
  lastError: null,
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockWebhookLog = (overrides: Partial<MockWebhookLog> = {}): MockWebhookLog => ({
  id: 1,
  webhookId: 1,
  event: 'article|afterCreate',
  payload: { articleId: 1, title: 'Test' },
  status: 'success',
  responseCode: 200,
  responseBody: '{"success":true}',
  error: null,
  duration: 150,
  createdAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockAnalytics = (overrides: Partial<MockAnalytics> = {}): MockAnalytics => ({
  id: 1,
  type: 'page_view',
  path: '/article/test-article',
  referrer: 'https://google.com',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  ip: '192.168.1.1',
  data: { duration: 30 },
  createdAt: dayjs('2024-01-01').format(),
  ...overrides,
});

// ============ Setting (Site Meta) Entity ============

export interface MockSetting {
  id: number;
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

export const createMockSetting = (overrides: Partial<MockSetting> = {}): MockSetting => ({
  id: 1,
  key: 'site.title',
  value: 'Test Blog',
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockComment = (overrides: Partial<MockComment> = {}): MockComment => ({
  id: 1,
  articleId: 1,
  parentId: null,
  author: 'Commenter',
  email: 'commenter@example.com',
  content: 'This is a test comment.',
  status: 'approved',
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockLoginLog = (overrides: Partial<MockLoginLog> = {}): MockLoginLog => ({
  id: 1,
  username: 'testuser',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  success: true,
  message: null,
  createdAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockCustomPage = (overrides: Partial<MockCustomPage> = {}): MockCustomPage => ({
  id: 1,
  title: 'About Page',
  pathname: '/about',
  content: '# About\n\nThis is the about page.',
  type: 'markdown',
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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
): MockPermissionNode => ({
  id: 1,
  name: 'article:create',
  description: 'Create new articles',
  module: 'article',
  isActive: true,
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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
): MockPermissionGroup => ({
  id: 1,
  name: 'editors',
  description: 'Editor group',
  permissions: ['article:create', 'article:update'],
  isActive: true,
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

// ============ Plugin Data Entity ============

export interface MockPluginData {
  id: number;
  pluginId: string;
  key: string;
  value: string | null;
  createdAt: string;
  updatedAt: string;
}

export const createMockPluginData = (overrides: Partial<MockPluginData> = {}): MockPluginData => ({
  id: 1,
  pluginId: 'test-plugin',
  key: 'config.enabled',
  value: 'true',
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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
): MockPluginMetadata => ({
  id: 1,
  pluginId: 'test-plugin',
  entityType: 'article',
  entityId: 1,
  metaKey: 'processed',
  metaValue: true,
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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
): MockImageProcessingQueue => ({
  id: 1,
  fileId: 1,
  status: 'pending',
  priority: 0,
  processingConfig: { width: 800, height: 600 },
  originalBuffer: null,
  processedBuffer: null,
  errorMessage: null,
  attempts: 0,
  maxAttempts: 3,
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  startedAt: null,
  completedAt: null,
  ...overrides,
});

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
): MockTokenBlacklist => ({
  id: 1,
  tokenHash: 'abc123hash',
  tokenType: 'access',
  userId: 1,
  reason: 'User logout',
  expiresAt: dayjs('2024-12-31').format(),
  createdAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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

export const createMockPipeline = (overrides: Partial<MockPipeline> = {}): MockPipeline => ({
  id: 1,
  name: 'Test Pipeline',
  description: 'A test pipeline',
  enabled: true,
  eventName: 'article|afterCreate',
  script: 'console.log("Hello");',
  deps: [],
  status: 'idle',
  lastRun: null,
  lastStatus: null,
  lastError: null,
  deleted: false,
  createdAt: dayjs('2024-01-01').format(),
  updatedAt: dayjs('2024-01-01').format(),
  ...overrides,
});

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
      id: index + 1,
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
      id: index + 1,
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
      id: index + 1,
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
      id: index + 1,
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
      id: index + 1,
      filename: `image-${String(index + 1)}.jpg`,
      path: `/uploads/images/image-${String(index + 1)}.jpg`,
      ...overrides,
    }),
  );
};
