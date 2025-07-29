export type LimitPermission =
  | 'article:create'
  | 'article:delete'
  | 'article:update'
  | 'draft:publish'
  | 'draft:create'
  | 'draft:delete'
  | 'draft:update'
  | 'img:delete';

export type Permission = LimitPermission | 'all';
