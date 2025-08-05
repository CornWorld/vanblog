// 基础权限节点
export type LimitPermission =
  | 'article:create'
  | 'article:read'
  | 'article:update'
  | 'article:delete'
  | 'article:publish'
  | 'draft:create'
  | 'draft:read'
  | 'draft:update'
  | 'draft:delete'
  | 'draft:publish'
  | 'category:create'
  | 'category:read'
  | 'category:update'
  | 'category:delete'
  | 'tag:create'
  | 'tag:read'
  | 'tag:update'
  | 'tag:delete'
  | 'media:create'
  | 'media:read'
  | 'media:update'
  | 'media:delete'
  | 'user:create'
  | 'user:read'
  | 'user:update'
  | 'user:delete'
  | 'setting:read'
  | 'setting:update'
  | 'analytics:read'
  | 'pipeline:create'
  | 'pipeline:read'
  | 'pipeline:update'
  | 'pipeline:delete'
  | 'pipeline:execute'
  | 'permission:manage';

// 权限组
export type PermissionGroup = 'group:admin' | 'group:editor' | 'group:author' | 'group:viewer';

// 禁用权限（以 no: 开头）
export type DisabledPermission = `no:${LimitPermission | PermissionGroup}`;

// 完整权限类型
export type Permission = LimitPermission | PermissionGroup | DisabledPermission | 'all';

// 权限模块映射
export const PERMISSION_MODULES = {
  article: [
    'article:create',
    'article:read',
    'article:update',
    'article:delete',
    'article:publish',
  ],
  draft: ['draft:create', 'draft:read', 'draft:update', 'draft:delete', 'draft:publish'],
  category: ['category:create', 'category:read', 'category:update', 'category:delete'],
  tag: ['tag:create', 'tag:read', 'tag:update', 'tag:delete'],
  media: ['media:create', 'media:read', 'media:update', 'media:delete'],
  user: ['user:create', 'user:read', 'user:update', 'user:delete'],
  setting: ['setting:read', 'setting:update'],
  analytics: ['analytics:read'],
  pipeline: [
    'pipeline:create',
    'pipeline:read',
    'pipeline:update',
    'pipeline:delete',
    'pipeline:execute',
  ],
  permission: ['permission:manage'],
} as const;

// 预定义权限组
export const PERMISSION_GROUPS = {
  admin: Object.values(PERMISSION_MODULES).flat(),
  editor: [
    ...PERMISSION_MODULES.article,
    ...PERMISSION_MODULES.draft,
    ...PERMISSION_MODULES.category,
    ...PERMISSION_MODULES.tag,
    ...PERMISSION_MODULES.media,
    'setting:read',
    'analytics:read',
  ],
  author: [
    'article:create',
    'article:read',
    'article:update',
    ...PERMISSION_MODULES.draft,
    'category:read',
    'tag:read',
    'tag:create',
    'media:create',
    'media:read',
    'media:update',
  ],
  viewer: [
    'article:read',
    'draft:read',
    'category:read',
    'tag:read',
    'media:read',
    'analytics:read',
  ],
} as const;
