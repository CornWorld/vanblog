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
  | 'permission:manage'
  | 'rss:generate'
  | 'rss:read'
  | 'sitemap:generate'
  | 'sitemap:read'
  | 'backup:create'
  | 'backup:read'
  | 'backup:download'
  | 'backup:delete'
  | 'backup:restore';

// 权限组
export type PermissionGroup = 'group:admin' | 'group:editor' | 'group:author' | 'group:viewer';

// 禁用权限（以 no: 开头）
export type DisabledPermission = `no:${LimitPermission | PermissionGroup}`;

// 完整权限类型
export type Permission = LimitPermission | PermissionGroup | DisabledPermission | 'all';

// 权限模块和权限组现在由各个模块自行注册
// 这个文件只保留类型定义
