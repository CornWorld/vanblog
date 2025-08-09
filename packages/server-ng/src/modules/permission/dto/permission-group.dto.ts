import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  selectPermissionGroupSchema,
  insertPermissionGroupSchema,
  updatePermissionGroupSchema,
} from '../../../database';

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

export class PermissionGroupDto extends createZodDto(PermissionGroupSchema) {}
export class CreatePermissionGroupDto extends createZodDto(CreatePermissionGroupSchema) {}
export class UpdatePermissionGroupDto extends createZodDto(UpdatePermissionGroupSchema) {}
export class PermissionGroupQueryDto extends createZodDto(PermissionGroupQuerySchema) {}

export type PermissionGroupType = z.infer<typeof PermissionGroupSchema>;
export type CreatePermissionGroupType = z.infer<typeof CreatePermissionGroupSchema>;
export type UpdatePermissionGroupType = z.infer<typeof UpdatePermissionGroupSchema>;
export type PermissionGroupQueryType = z.infer<typeof PermissionGroupQuerySchema>;
