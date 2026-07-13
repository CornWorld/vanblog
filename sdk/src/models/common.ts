import { z } from "zod";

export const RecordIdSchema = z.string().min(1);
const PocketBaseDateTimeSchema = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}(Z|[+-]\d{2}:\d{2})$/.test(
        value
      ),
    "Invalid PocketBase datetime"
  );

export const IsoDateTimeSchema = z.union([
  PocketBaseDateTimeSchema,
  z.iso.datetime({ offset: true }),
  z.literal(""),
]);

export const SystemFieldsSchema = z.object({
  id: RecordIdSchema.optional(),
  collectionId: z.string().optional(),
  collectionName: z.string().optional(),
  created: IsoDateTimeSchema.optional(),
  updated: IsoDateTimeSchema.optional(),
});

export type SystemFields = z.infer<typeof SystemFieldsSchema>;
