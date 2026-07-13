import { z } from "zod";
import { SystemFieldsSchema } from "./common";

export const CategoryMetaSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .catchall(z.unknown());
export const CategorySchema = SystemFieldsSchema.extend({
  name: z.string().min(1),
  type: z.enum(["category", "column"]).optional(),
  private: z.boolean().optional(),
  password: z.string().optional(),
  meta: CategoryMetaSchema.nullable().optional(),
  oldId: z.number().optional(),
});
export type CategoryMeta = z.infer<typeof CategoryMetaSchema>;
export type Category = z.infer<typeof CategorySchema>;
