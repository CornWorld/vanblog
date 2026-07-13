import { z } from "zod";
import {
  IsoDateTimeSchema,
  RecordIdSchema,
  SystemFieldsSchema,
} from "./common";
import { PostSchema } from "./posts";

export const VisitSchema = SystemFieldsSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  path: z.string().optional(),
  views: z.number().int().nonnegative().optional(),
  uniques: z.number().int().nonnegative().optional(),
  post: RecordIdSchema.optional(),
  lastVisitedAt: IsoDateTimeSchema.optional(),
});
export const VisitExpandSchema = VisitSchema.extend({
  expand: z.object({ post: PostSchema.optional() }).optional(),
});
export type Visit = z.infer<typeof VisitSchema>;
export type VisitExpand = z.infer<typeof VisitExpandSchema>;
