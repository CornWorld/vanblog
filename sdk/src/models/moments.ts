import { z } from "zod";
import { RecordIdSchema, SystemFieldsSchema } from "./common";
import { UserSchema } from "./users";

export const MomentSchema = SystemFieldsSchema.extend({
  content: z.string().min(1).max(500),
  author: RecordIdSchema,
  visible: z.boolean().optional(),
});
export const MomentExpandSchema = MomentSchema.extend({
  expand: z.object({ author: UserSchema.optional() }).optional(),
});
export type Moment = z.infer<typeof MomentSchema>;
export type MomentExpand = z.infer<typeof MomentExpandSchema>;
