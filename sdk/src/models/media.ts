import { z } from "zod";
import { SystemFieldsSchema } from "./common";

export const MediaMetaSchema = z
  .object({
    width: z.number().int().nonnegative().optional(),
    height: z.number().int().nonnegative().optional(),
    size: z.number().int().nonnegative().optional(),
    source: z.string().optional(),
    post: z.string().optional(),
    originalName: z.string().optional(),
  })
  .catchall(z.unknown());
export const MediaSchema = SystemFieldsSchema.extend({
  file: z.string().optional(),
  staticType: z.enum(["img", "favicon", "attachment"]).optional(),
  storageType: z.enum(["local", "s3", "external"]).optional(),
  fileType: z.string().optional(),
  sign: z.string().optional(),
  meta: MediaMetaSchema.nullable().optional(),
  externalUrl: z.string().optional(),
  oldId: z.number().optional(),
});
export type MediaMeta = z.infer<typeof MediaMetaSchema>;
export type Media = z.infer<typeof MediaSchema>;
