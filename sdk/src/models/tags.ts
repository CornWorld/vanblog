import { z } from "zod";
import { SystemFieldsSchema } from "./common";

export const TagSchema = SystemFieldsSchema.extend({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  oldName: z.string().optional(),
});
export type Tag = z.infer<typeof TagSchema>;
