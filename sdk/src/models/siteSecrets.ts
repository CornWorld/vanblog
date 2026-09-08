import { z } from "zod";
import { SystemFieldsSchema } from "./common";
import {
  OutputConfigSchema,
  S3ConfigSchema,
  SyncConfigSchema,
} from "./fields";

/**
 * site_secrets — admin-only singleton row (key "main") holding the
 * credential-bearing site configuration moved off the publicly readable
 * `site` collection (migration 1783600100). Records in this collection are
 * never exposed to anonymous callers; the schema mirrors the secret fields
 * parked by internal/site.MoveSecretsFromRecord.
 */
export const SiteSecretsSchema = SystemFieldsSchema.extend({
  key: z.string().min(1),
  s3Config: S3ConfigSchema.nullable().optional(),
  syncConfig: SyncConfigSchema.nullable().optional(),
  syncRemote: z.string().optional(),
  outputConfig: OutputConfigSchema.nullable().optional(),
});
export type SiteSecrets = z.infer<typeof SiteSecretsSchema>;
