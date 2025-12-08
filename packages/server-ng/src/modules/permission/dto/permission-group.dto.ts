import {
  selectPermissionGroupSchema,
  insertPermissionGroupSchema,
  updatePermissionGroupSchema,
} from '@vanblog/shared/drizzle';
import { z } from 'zod';

// 权限组基础 Schema
export const PermissionGroupSchema = selectPermissionGroupSchema;

// 创建权限组 Schema
export const CreatePermissionGroupSchema = insertPermissionGroupSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 更新权限组 Schema
export const UpdatePermissionGroupSchema = updatePermissionGroupSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();

// 查询权限组 Schema
export const PermissionGroupQuerySchema = z.object({
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

export type PermissionGroupDto = z.infer<typeof PermissionGroupSchema>;
export type CreatePermissionGroupDto = z.infer<typeof CreatePermissionGroupSchema>;
export type UpdatePermissionGroupDto = z.infer<typeof UpdatePermissionGroupSchema>;
export type PermissionGroupQueryDto = z.infer<typeof PermissionGroupQuerySchema>;

export type PermissionGroupType = z.infer<typeof PermissionGroupSchema>;
export type CreatePermissionGroupType = z.infer<typeof CreatePermissionGroupSchema>;
export type UpdatePermissionGroupType = z.infer<typeof UpdatePermissionGroupSchema>;
export type PermissionGroupQueryType = z.infer<typeof PermissionGroupQuerySchema>;
