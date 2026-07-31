export * from "./common";
export * from "./fields";
export * from "./tags";
export * from "./categories";
export * from "./users";
export * from "./posts";
export * from "./revisions";
export * from "./media";
export * from "./site";
export * from "./visits";
export * from "./audits";
export * from "./moments";
export * from "./bookmarks";

import { TagSchema } from "./tags";
import { CategorySchema } from "./categories";
import { UserSchema } from "./users";
import { PostSchema } from "./posts";
import { RevisionSchema } from "./revisions";
import { MediaSchema } from "./media";
import { SiteSchema } from "./site";
import { VisitSchema } from "./visits";
import { AuditSchema } from "./audits";
import { MomentSchema } from "./moments";
import { BookmarkSchema } from "./bookmarks";

export const models = {
  tags: TagSchema,
  categories: CategorySchema,
  users: UserSchema,
  posts: PostSchema,
  revisions: RevisionSchema,
  media: MediaSchema,
  site: SiteSchema,
  visits: VisitSchema,
  audits: AuditSchema,
  moments: MomentSchema,
  bookmarks: BookmarkSchema,
} as const;
