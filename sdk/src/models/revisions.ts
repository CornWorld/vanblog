import { z } from "zod";
import { RecordIdSchema, SystemFieldsSchema } from "./common";
import { PostSchema } from "./posts";
import { UserSchema } from "./users";

export const RevisionSnapshotSchema = z.object({
  title: z.string(),
  content: z.string(),
  status: z.enum(["draft", "published", "hidden"]),
});
export const RevisionSchema = SystemFieldsSchema.extend({
  target: RecordIdSchema,
  snapshot: RevisionSnapshotSchema,
  authoredBy: RecordIdSchema.optional(),
  reason: z.enum(["auto-save", "manual", "publish", "restore", "import"]).optional(),
});
export const RevisionExpandSchema = RevisionSchema.extend({
  expand: z.object({ target: PostSchema.optional(), authoredBy: UserSchema.optional() }).optional(),
});
export type RevisionSnapshot = z.infer<typeof RevisionSnapshotSchema>;
export type Revision = z.infer<typeof RevisionSchema>;
export type RevisionExpand = z.infer<typeof RevisionExpandSchema>;
