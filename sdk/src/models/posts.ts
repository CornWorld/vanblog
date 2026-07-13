import { z } from "zod";
import {
  IsoDateTimeSchema,
  RecordIdSchema,
  SystemFieldsSchema,
} from "./common";
import { TagSchema } from "./tags";
import { CategorySchema } from "./categories";
import { UserSchema } from "./users";

// ── Stored record ─────────────────────────────────────────────────────

export const PostSchema = SystemFieldsSchema.extend({
  title: z.string().min(1),
  content: z.string().optional(),
  copyright: z.string().optional(),
  deleted: z.boolean().optional(),
  lastVisitedAt: IsoDateTimeSchema.optional(),
  oldId: z.number().optional(),
  password: z.string().optional(),
  pathname: z.string().optional(),
  private: z.boolean().optional(),
  status: z.enum(["draft", "published", "hidden"]).optional(),
  top: z.number().int().nonnegative().optional(),
  viewCount: z.number().int().nonnegative().optional(),
  visitedCount: z.number().int().nonnegative().optional(),
  author: RecordIdSchema.optional(),
  category: RecordIdSchema.optional(),
  tags: z.array(RecordIdSchema).optional(),
});
export type Post = z.infer<typeof PostSchema>;

// ── Expanded shape (relations resolved) ───────────────────────────────

export const PostExpandSchema = PostSchema.extend({
  expand: z
    .object({
      author: UserSchema.optional(),
      category: CategorySchema.optional(),
      tags: z.array(TagSchema).optional(),
    })
    .optional(),
});
export type PostExpand = z.infer<typeof PostExpandSchema>;
