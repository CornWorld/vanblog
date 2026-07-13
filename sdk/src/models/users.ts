import { z } from "zod";
import { SystemFieldsSchema } from "./common";

export const PermissionSchema = z.enum([
  "article:create",
  "article:delete",
  "article:update",
  "draft:publish",
  "draft:create",
  "draft:delete",
  "draft:update",
  "img:delete",
  "all",
]);
export const UserSchema = SystemFieldsSchema.extend({
  username: z.string().min(1),
  nickname: z.string().optional(),
  role: z.enum(["admin", "collaborator"]).optional(),
  permissions: z.array(PermissionSchema).optional(),
  oldId: z.number().optional(),
  email: z.string().optional(),
  emailVisibility: z.boolean().optional(),
  verified: z.boolean().optional(),
  avatar: z.string().optional(),
  tokenKey: z.string().optional(),
});
export type Permission = z.infer<typeof PermissionSchema>;
export type User = z.infer<typeof UserSchema>;
