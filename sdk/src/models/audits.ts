import { z } from "zod";
import { RecordIdSchema, SystemFieldsSchema } from "./common";
import { UserSchema } from "./users";

export const AuditDetailSchema = z
  .object({
    before: z.array(z.string()).optional(),
    after: z.array(z.string()).optional(),
    allowlist: z.number().int().nonnegative().optional(),
    rollback: z.boolean().optional(),
    caddyError: z.string().optional(),
    field: z.string().optional(),
    old: z.string().optional(),
    new: z.string().optional(),
    content: z.string().optional(),
  })
  .catchall(z.unknown());
export const AuditSchema = SystemFieldsSchema.extend({
  actor: RecordIdSchema.optional(),
  action: z.string().optional(),
  target: z.string().optional(),
  result: z.enum(["success", "failure"]).optional(),
  detail: AuditDetailSchema.nullable().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});
export const AuditExpandSchema = AuditSchema.extend({
  expand: z.object({ actor: UserSchema.optional() }).optional(),
});
export type AuditDetail = z.infer<typeof AuditDetailSchema>;
export type Audit = z.infer<typeof AuditSchema>;
export type AuditExpand = z.infer<typeof AuditExpandSchema>;
