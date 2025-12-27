import {
  selectPermissionGroupSchema,
  insertPermissionGroupSchema,
  updatePermissionGroupSchema,
} from '@vanblog/shared/drizzle';
import { z } from 'zod';

// 权限组基础 Schema
export const PermissionGroupSchema = selectPermissionGroupSchema;

// 创建权限组 Schema
export const CreatePermissionGroupSchema = insertPermissionGroupSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    permissions: insertPermissionGroupSchema.shape.permissions.optional(),
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

// DTO 类型别名（用于服务层）
export type PermissionGroupDto = z.infer<typeof PermissionGroupSchema>;
export type PermissionGroupQueryType = z.infer<typeof PermissionGroupQuerySchema>;

export type PermissionGroupType = z.infer<typeof PermissionGroupSchema>;
export type CreatePermissionGroupType = z.infer<typeof CreatePermissionGroupSchema>;
export type UpdatePermissionGroupType = z.infer<typeof UpdatePermissionGroupSchema>;

// DTO 类（用于装饰器参数，支持 isolatedModules）
export class CreatePermissionGroupDto {
  name!: string;
  description?: string | null;
  permissions: string[] | null = null;
  isActive: boolean | null = null;
}

export class UpdatePermissionGroupDto {
  name?: string;
  description?: string;
  permissions?: string[] | null;
  isActive?: boolean;
}

export class PermissionGroupQueryDto {
  isActive?: boolean;
  page: number = 1;
  limit: number = 10;
}
