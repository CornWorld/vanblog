import { z } from "zod";
import { RecordIdSchema, SystemFieldsSchema } from "./common";
import { UserSchema } from "./users";

export const BookmarkSchema = SystemFieldsSchema.extend({
  title: z.string().min(1),
  url: z.url(),
  description: z.string().optional(),
  owner: RecordIdSchema,
});
export const BookmarkExpandSchema = BookmarkSchema.extend({
  expand: z.object({ owner: UserSchema.optional() }).optional(),
});
export type Bookmark = z.infer<typeof BookmarkSchema>;
export type BookmarkExpand = z.infer<typeof BookmarkExpandSchema>;
